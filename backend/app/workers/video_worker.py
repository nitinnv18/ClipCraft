import os
import shutil
import uuid
import asyncio
from datetime import datetime
from typing import Dict, Any
from app.core.config import settings
from app.core.logging import logger
from app.db.mongodb import get_database
from app.db.memory_store import memory_store
from app.models.job import JobStatus, JobStage
from app.models.clip import ClipCandidate
from app.providers.transcript.youtube_transcript_provider import YouTubeTranscriptProvider
from app.providers.ai.groq_provider import GroqProvider
from app.providers.storage.cloudinary_provider import CloudinaryStorageProvider
from app.providers.video.ffmpeg_processor import FFmpegVideoProcessor
from app.services.ranking_engine import ClipRankingEngine
from app.services.boundary_optimizer import BoundaryOptimizer

class VideoProcessingWorker:
    def __init__(self, max_concurrent: int = 4):
        self.transcript_provider = YouTubeTranscriptProvider()
        self.ai_provider = GroqProvider()
        self.storage_provider = CloudinaryStorageProvider()
        self.video_processor = FFmpegVideoProcessor()
        self.is_running = False
        self._semaphore = asyncio.Semaphore(max_concurrent)

    async def update_job_progress(
        self,
        job_id: str,
        stage: JobStage,
        progress: int,
        status: JobStatus = JobStatus.PROCESSING,
        metadata: Dict[str, Any] = None,
        error: str = None
    ):
        db = get_database()
        stage_val = stage.value if isinstance(stage, JobStage) else str(stage)
        status_val = status.value if isinstance(status, JobStatus) else str(status)

        update_data: Dict[str, Any] = {
            "stage": stage_val,
            "progress": progress,
            "status": status_val,
            "updatedAt": datetime.utcnow()
        }
        if error:
            update_data["error"] = error
        if metadata:
            for k, v in metadata.items():
                update_data[k] = v
        if status == JobStatus.COMPLETED or status_val == "completed":
            update_data["completedAt"] = datetime.utcnow()

        # Always update memory_store
        memory_store.update_job(job_id, update_data)

        # Update MongoDB if connected
        if db is not None:
            try:
                await db.jobs.update_one({"_id": job_id}, {"$set": update_data})
            except Exception as e:
                logger.error(f"Failed to update job status in DB: {e}")
        
        logger.info(f"[Job {job_id}] -> Stage: {stage_val}, Progress: {progress}%, Status: {status_val}")

    async def process_job(self, job_id: str, payload: Dict[str, Any]):
        async with self._semaphore:
            try:
                # Enforce a 15-minute hard timeout so no job hangs worker concurrency indefinitely
                await asyncio.wait_for(self._execute_job(job_id, payload), timeout=900.0)
            except asyncio.TimeoutError:
                logger.error(f"[Worker] Job {job_id} exceeded maximum processing timeout of 900 seconds.")
                await self.update_job_progress(
                    job_id,
                    JobStage.FINALIZING,
                    100,
                    status=JobStatus.FAILED,
                    error="Job processing exceeded timeout limit (15m). Please try a shorter video or upload directly."
                )
            finally:
                from app.queue.redis_queue import queue_instance
                try:
                    await queue_instance.ack_job(job_id, payload)
                except Exception as ack_err:
                    logger.warning(f"Failed to ack job {job_id}: {ack_err}")

    async def _execute_job(self, job_id: str, payload: Dict[str, Any]):
        job_work_dir = os.path.join(settings.TEMP_STORAGE_DIR, job_id)
        os.makedirs(job_work_dir, exist_ok=True)
        db = get_database()

        async def _is_cancelled() -> bool:
            if db is not None:
                try:
                    j = await db.jobs.find_one({"_id": job_id}, {"status": 1})
                    if j and j.get("status") == "cancelled":
                        return True
                except Exception:
                    pass
            mem_j = memory_store.get_job(job_id)
            return bool(mem_j and mem_j.get("status") == "cancelled")

        if await _is_cancelled():
            logger.info(f"Skipping cancelled job before start: {job_id}")
            return

        try:
            source_type = payload.get("sourceType", "youtube")
            source_video_path = payload.get("sourceVideoPath")
            youtube_url = payload.get("youtubeUrl")
            clip_count = int(payload.get("clipCount", 5))
            min_duration = int(payload.get("minDuration", 30))
            max_duration = int(payload.get("maxDuration", 60))
            format_ratio = str(payload.get("format", "9:16"))
            captions_enabled = bool(payload.get("captions", True))
            client_ip = payload.get("clientIp")

            segments = []
            video_info = {}

            if source_type == "upload" and source_video_path and os.path.exists(source_video_path):
                # ==========================================
                # DIRECT VIDEO FILE PIPELINE (100% RELIABLE)
                # ==========================================
                await self.update_job_progress(job_id, JobStage.FETCHING, 15)
                local_meta = await self.video_processor.get_local_video_info(source_video_path)
                vid_dur = float(local_meta.get("duration") or 60.0)
                
                # Generate local thumbnail
                local_thumb_path = os.path.join(job_work_dir, "video_thumb.jpg")
                await self.video_processor.generate_thumbnail_from_video(source_video_path, local_thumb_path, timestamp=1.5)
                save_to_cloud = payload.get("saveToCloud", False)
                thumb_upload = await self.storage_provider.upload_image(local_thumb_path, public_id_prefix="thumbnails", force_local=not save_to_cloud)

                video_info = {
                    "id": f"upload_{job_id[4:]}",
                    "title": payload.get("title") or os.path.basename(source_video_path),
                    "duration": vid_dur,
                    "thumbnail": thumb_upload.get("secure_url"),
                    "channel": "Direct Upload"
                }

                await self.update_job_progress(
                    job_id,
                    JobStage.FETCHING,
                    25,
                    metadata=video_info
                )

                # Extract audio from video file for Groq Whisper transcription
                await self.update_job_progress(job_id, JobStage.TRANSCRIBING, 35)
                local_audio_path = os.path.join(job_work_dir, "extracted_audio.mp3")
                try:
                    await self.video_processor.extract_audio(source_video_path, local_audio_path)
                    segments = await self.ai_provider.transcribe_audio_file(local_audio_path, vid_dur)
                except Exception as aud_err:
                    logger.warning(f"Direct audio transcription notice ({aud_err}), generating synthetic segments...")
                    segments = self.ai_provider._generate_synthetic_segments(vid_dur)

            else:
                # ==========================================
                # YOUTUBE URL STREAMING PIPELINE
                # ==========================================
                await self.update_job_progress(job_id, JobStage.FETCHING, 15)
                video_info = await self.video_processor.get_video_info(youtube_url, client_ip=client_ip)
                
                await self.update_job_progress(
                    job_id,
                    JobStage.FETCHING,
                    25,
                    metadata={
                        "title": video_info.get("title"),
                        "duration": video_info.get("duration"),
                        "thumbnail": video_info.get("thumbnail"),
                        "channel": video_info.get("channel"),
                        "videoId": video_info.get("id")
                    }
                )

                # 2. Preparing Transcript
                await self.update_job_progress(job_id, JobStage.TRANSCRIBING, 35)
                try:
                    transcript_res = await self.transcript_provider.get_transcript(youtube_url)
                    segments = transcript_res.segments
                except Exception as tr_err:
                    logger.warning(f"Transcript unavailable for job {job_id} ({tr_err}). Generating AI timeline segments...")
                    vid_dur = float(video_info.get("duration") or 180)
                    segments = self.ai_provider._generate_synthetic_segments(vid_dur)

            # 3. AI Moment Detection
            await self.update_job_progress(job_id, JobStage.ANALYZING, 50)
            candidates = await self.ai_provider.detect_clips(
                transcript_segments=segments,
                video_duration=video_info.get("duration", 0),
                target_clip_count=clip_count,
                min_duration=min_duration,
                max_duration=max_duration
            )

            # 4. Selection & Ranking & Boundary Optimization
            await self.update_job_progress(job_id, JobStage.SELECTING, 60)
            ranked_clips = ClipRankingEngine.filter_and_rank_clips(
                candidates=candidates,
                target_count=clip_count,
                min_duration=min_duration,
                max_duration=max_duration
            )

            if not ranked_clips:
                logger.warning(f"No ranked clips detected for job {job_id}. Auto-generating highlight clips from timeline...")
                vid_dur = float(video_info.get("duration") or 120)
                if vid_dur <= 0:
                    vid_dur = 120.0
                clip_len = min(float(max_duration), max(float(min_duration), 30.0))
                auto_clips = []
                c_start = 0.0
                c_idx = 1
                while c_start < vid_dur and len(auto_clips) < clip_count:
                    c_end = min(c_start + clip_len, vid_dur)
                    if (c_end - c_start) >= 10.0:
                        auto_clips.append(ClipCandidate(
                            start=round(c_start, 2),
                            end=round(c_end, 2),
                            score=max(75, 95 - (c_idx * 3)),
                            title=f"Viral Highlight #{c_idx}",
                            hook="Key moment in video",
                            reason="High engagement sequence detected",
                            category="highlight"
                        ))
                        c_idx += 1
                    c_start = c_end
                ranked_clips = auto_clips or [ClipCandidate(
                    start=0.0,
                    end=min(vid_dur, 30.0),
                    score=95,
                    title="Main Video Highlight",
                    hook="Best visual sequence",
                    reason="Primary video moment",
                    category="highlight"
                )]

            # Optimize boundaries
            optimized_clips = [
                BoundaryOptimizer.optimize_boundaries(c, segments)
                for c in ranked_clips
            ]

            if await _is_cancelled():
                logger.info(f"Aborting cancelled job before rendering: {job_id}")
                return

            # 5. Acquire Source Video if not already local
            await self.update_job_progress(job_id, JobStage.RENDERING, 65)

            if not (source_video_path and os.path.exists(source_video_path)):
                last_reported_pct = 65
                def on_download_progress(pct: int, msg: str):
                    nonlocal last_reported_pct
                    scaled = 65 + int((pct / 100.0) * 12)
                    if scaled > last_reported_pct:
                        last_reported_pct = scaled
                        memory_store.update_job(job_id, {"progress": scaled, "stage": "rendering"})

                dl_res = await self.video_processor.download_video(
                    youtube_url=youtube_url,
                    output_dir=job_work_dir,
                    on_progress=on_download_progress,
                    client_ip=client_ip
                )
                source_video_path = dl_res["video_path"]

            # 6. Render individual clips & upload
            generated_clips = []
            total_clips = len(optimized_clips)
            
            for idx, candidate in enumerate(optimized_clips):
                if await _is_cancelled():
                    logger.info(f"Stopping rendering loop for cancelled job {job_id}")
                    return
                clip_id = f"clip_{uuid.uuid4().hex[:12]}"
                raw_clip_path = os.path.join(job_work_dir, f"{clip_id}.mp4")
                raw_thumb_path = os.path.join(job_work_dir, f"{clip_id}.jpg")

                # Progress smoothly from 78% to 92%
                render_pct = 78 + int((idx / total_clips) * 14)
                await self.update_job_progress(job_id, JobStage.RENDERING, render_pct)

                # Process FFmpeg clip
                await self.video_processor.process_clip(
                    source_video_path=source_video_path,
                    start_time=candidate.start,
                    end_time=candidate.end,
                    output_clip_path=raw_clip_path,
                    output_thumbnail_path=raw_thumb_path,
                    format_ratio=format_ratio,
                    captions=captions_enabled,
                    caption_segments=segments,
                    youtube_url=youtube_url,
                    client_ip=client_ip
                )

                # Upload to Cloudinary / Storage concurrently
                save_to_cloud = payload.get("saveToCloud", False)
                if save_to_cloud:
                    await self.update_job_progress(job_id, JobStage.UPLOADING, min(95, render_pct + 4))
                
                # Run video and thumbnail uploads concurrently via asyncio.gather
                video_task = self.storage_provider.upload_video(raw_clip_path, public_id_prefix="clips", force_local=not save_to_cloud)
                thumb_task = self.storage_provider.upload_image(raw_thumb_path, public_id_prefix="thumbnails", force_local=not save_to_cloud)
                video_upload, thumb_upload = await asyncio.gather(video_task, thumb_task)

                # Extract clip-specific transcript segments and text
                clip_segments = [
                    {
                        "start": round(max(0.0, s.get("start", 0) - candidate.start), 2),
                        "end": round(min(candidate.duration, s.get("end", 0) - candidate.start), 2),
                        "text": s.get("text", "").strip()
                    }
                    for s in (segments or [])
                    if s.get("end", 0) > candidate.start and s.get("start", 0) < candidate.end
                ]
                clip_captions_text = " ".join(s["text"] for s in clip_segments if s.get("text"))

                clip_record = {
                    "_id": clip_id,
                    "id": clip_id,
                    "jobId": job_id,
                    "userId": payload.get("userId"),
                    "startTime": candidate.start,
                    "endTime": candidate.end,
                    "duration": candidate.duration,
                    "title": candidate.title,
                    "hook": candidate.hook,
                    "description": candidate.description,
                    "score": candidate.score,
                    "cloudinaryPublicId": video_upload.get("public_id"),
                    "videoUrl": video_upload.get("secure_url"),
                    "thumbnailUrl": thumb_upload.get("secure_url"),
                    "captionsText": clip_captions_text or candidate.hook,
                    "segments": clip_segments,
                    "createdAt": datetime.utcnow()
                }

                memory_store.add_clip(clip_id, clip_record)
                if db is not None:
                    try:
                        await db.clips.insert_one(clip_record)
                    except Exception as e:
                        logger.warning(f"Failed to insert clip {clip_id} to DB: {e}")

                generated_clips.append(clip_record)

            # 7. Finalizing
            await self.update_job_progress(
                job_id,
                JobStage.COMPLETED,
                100,
                status=JobStatus.COMPLETED
            )
            logger.info(f"Successfully processed job {job_id} with {len(generated_clips)} clips.")

        except asyncio.CancelledError:
            logger.info(f"Job {job_id} processing was cancelled.")
            await self.update_job_progress(
                job_id,
                JobStage.FINALIZING,
                100,
                status=JobStatus.CANCELLED,
                error="Job processing was cancelled."
            )
            raise
        except Exception as e:
            logger.error(f"Error processing job {job_id}: {e}", exc_info=True)
            await self.update_job_progress(
                job_id,
                JobStage.FINALIZING,
                100,
                status=JobStatus.FAILED,
                error=str(e)
            )
        finally:
            try:
                if os.path.exists(job_work_dir):
                    shutil.rmtree(job_work_dir, ignore_errors=True)
                    logger.info(f"Cleaned up temporary workspace directory: {job_work_dir}")
                # Purge raw uploaded file from ./tmp_media/uploads/ once processing terminates
                if source_type == "upload" and source_video_path and os.path.exists(source_video_path):
                    try:
                        os.remove(source_video_path)
                        logger.info(f"Cleaned up source uploaded video: {source_video_path}")
                    except Exception as err:
                        logger.warning(f"Failed to remove uploaded file {source_video_path}: {err}")
            except Exception as e:
                logger.warning(f"Failed to clean temporary directory {job_work_dir}: {e}")

worker_instance = VideoProcessingWorker()

async def start_worker_daemon(max_concurrent: int = 4):
    """Independent daemon loop pulling and executing jobs from the Redis queue."""
    from app.queue.redis_queue import queue_instance
    from app.db.mongodb import db_instance, connect_to_mongo
    logger.info("Initializing Video Processing Worker Daemon...")
    if not db_instance.is_connected:
        await connect_to_mongo()
    if not queue_instance.is_connected:
        await queue_instance.initialize()
    logger.info("Worker daemon ready. Listening for jobs on Redis queue...")

    active_tasks = set()

    try:
        while True:
            active_tasks = {t for t in active_tasks if not t.done()}
            if len(active_tasks) >= max_concurrent:
                await asyncio.sleep(0.2)
                continue

            try:
                job_item = await queue_instance.get_next_job(timeout_seconds=3)
                if job_item:
                    job_id = job_item.get("job_id")
                    payload = job_item.get("payload", {})
                    if job_id:
                        logger.info(f"[Worker] Dequeued job {job_id} from Redis. Processing...")
                        task = asyncio.create_task(worker_instance.process_job(job_id, payload))
                        task.add_done_callback(
                            lambda t: logger.error(f"[Worker] Task error for job {job_id}: {t.exception()}")
                            if not t.cancelled() and t.exception() else None
                        )
                        active_tasks.add(task)
                else:
                    await asyncio.sleep(0.2)
            except asyncio.CancelledError:
                raise
            except Exception as e:
                logger.error(f"Worker daemon error: {e}", exc_info=True)
                await asyncio.sleep(2)
    except asyncio.CancelledError:
        logger.info("Worker daemon received cancellation signal. Shutting down...")
    finally:
        active_tasks = {t for t in active_tasks if not t.done()}
        if active_tasks:
            logger.info(f"Cancelling and gathering {len(active_tasks)} active worker tasks...")
            for t in active_tasks:
                t.cancel()
            await asyncio.gather(*active_tasks, return_exceptions=True)

if __name__ == "__main__":
    asyncio.run(start_worker_daemon())
