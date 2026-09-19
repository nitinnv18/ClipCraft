import os
import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any
from app.core.config import settings
from app.db.mongodb import get_database
from app.db.memory_store import memory_store
from app.models.job import JobCreateRequest, JobResponse, JobStatus, JobStage
from app.models.clip import ClipResponse
from app.queue.redis_queue import queue_instance
from app.providers.transcript.youtube_transcript_provider import YouTubeTranscriptProvider
from app.core.logging import logger

class JobService:
    @staticmethod
    def validate_youtube_url(url: str) -> Optional[str]:
        if not url:
            return None
        return YouTubeTranscriptProvider.extract_video_id(url)

    @staticmethod
    async def create_job(
        req: JobCreateRequest,
        user_id: str,
        background_tasks_handler=None,
        client_ip: Optional[str] = None
    ) -> Dict[str, Any]:
        video_id = JobService.validate_youtube_url(req.youtubeUrl or "")
        if req.sourceType == "youtube" and not video_id:
            raise ValueError("Please enter a valid YouTube video URL.")

        job_id = f"job_{uuid.uuid4().hex[:12]}"
        now = datetime.utcnow()
        estimated_seconds = 15 + (req.clipCount * 8)

        job_doc = {
            "_id": job_id,
            "id": job_id,
            "userId": user_id,
            "youtubeUrl": req.youtubeUrl,
            "videoId": video_id or "custom_video",
            "sourceType": req.sourceType or "youtube",
            "title": "Initializing video analysis...",
            "duration": 0.0,
            "thumbnail": f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg" if video_id else None,
            "channel": None,
            "status": JobStatus.QUEUED.value,
            "progress": 0,
            "stage": JobStage.INITIALIZING.value,
            "clipCount": req.clipCount,
            "estimatedSeconds": estimated_seconds,
            "settings": req.model_dump(),
            "createdAt": now,
            "startedAt": now,
            "completedAt": None,
            "error": None
        }

        memory_store.set_job(job_id, job_doc)

        db = get_database()
        if db is not None:
            try:
                await db.jobs.insert_one(job_doc)
            except Exception as e:
                logger.warning(f"DB insert notice: {e}")

        payload = {
            "jobId": job_id,
            "userId": user_id,
            "youtubeUrl": req.youtubeUrl,
            "videoId": video_id or "custom_video",
            "sourceType": req.sourceType or "youtube",
            "clipCount": req.clipCount,
            "minDuration": req.minDuration,
            "maxDuration": req.maxDuration,
            "format": req.format,
            "captions": req.captions,
            "saveToCloud": req.saveToCloud,
            "clientIp": client_ip,
            "estimatedSeconds": estimated_seconds
        }

        await queue_instance.enqueue_job(job_id, payload)
        if background_tasks_handler:
            from app.workers.video_worker import worker_instance
            background_tasks_handler.add_task(worker_instance.process_job, job_id, payload)

        logger.info(f"Created video clipping job {job_id} for user {user_id}")
        return job_doc

    @staticmethod
    async def create_upload_job(
        file_path: str,
        filename: str,
        user_id: str,
        clip_count: int = 5,
        min_duration: int = 30,
        max_duration: int = 60,
        format_ratio: str = "9:16",
        captions: bool = True,
        save_to_cloud: bool = True,
        background_tasks_handler=None,
        client_ip: Optional[str] = None
    ) -> Dict[str, Any]:
        job_id = f"job_{uuid.uuid4().hex[:12]}"
        now = datetime.utcnow()
        estimated_seconds = 15 + (clip_count * 8)

        clean_title = os.path.splitext(filename)[0].replace("_", " ").title()

        settings_dict = {
            "clipCount": clip_count,
            "minDuration": min_duration,
            "maxDuration": max_duration,
            "format": format_ratio,
            "captions": captions,
            "saveToCloud": save_to_cloud
        }

        job_doc = {
            "_id": job_id,
            "id": job_id,
            "userId": user_id,
            "youtubeUrl": None,
            "videoId": "upload_" + job_id[4:],
            "sourceType": "upload",
            "sourceVideoPath": file_path,
            "title": clean_title or "Uploaded Video File",
            "duration": 0.0,
            "thumbnail": None,
            "channel": "Direct Upload",
            "status": JobStatus.QUEUED.value,
            "progress": 0,
            "stage": JobStage.INITIALIZING.value,
            "clipCount": clip_count,
            "estimatedSeconds": estimated_seconds,
            "settings": settings_dict,
            "createdAt": now,
            "startedAt": now,
            "completedAt": None,
            "error": None
        }

        memory_store.set_job(job_id, job_doc)

        db = get_database()
        if db is not None:
            try:
                await db.jobs.insert_one(job_doc)
            except Exception as e:
                logger.warning(f"DB insert notice: {e}")

        payload = {
            "jobId": job_id,
            "userId": user_id,
            "youtubeUrl": None,
            "videoId": "upload_" + job_id[4:],
            "sourceType": "upload",
            "sourceVideoPath": file_path,
            "filename": filename,
            "title": clean_title,
            "clipCount": clip_count,
            "minDuration": min_duration,
            "maxDuration": max_duration,
            "format": format_ratio,
            "captions": captions,
            "saveToCloud": save_to_cloud,
            "clientIp": client_ip,
            "estimatedSeconds": estimated_seconds
        }

        await queue_instance.enqueue_job(job_id, payload)
        if background_tasks_handler:
            from app.workers.video_worker import worker_instance
            background_tasks_handler.add_task(worker_instance.process_job, job_id, payload)

        logger.info(f"Created upload video clipping job {job_id} for user {user_id}")
        return job_doc

    @staticmethod
    async def get_user_jobs(user_id: str) -> List[Dict[str, Any]]:
        db = get_database()
        jobs = []
        if db is not None:
            try:
                cursor = db.jobs.find({"userId": user_id}).sort("createdAt", -1)
                async for doc in cursor:
                    doc["id"] = doc.get("_id", doc.get("id"))
                    jobs.append(doc)
                return jobs
            except Exception:
                pass

        for j in memory_store.jobs.values():
            if j.get("userId") == user_id:
                c = dict(j)
                c["id"] = c.get("_id", c.get("id"))
                jobs.append(c)
        jobs.sort(key=lambda x: x.get("createdAt", datetime.min), reverse=True)
        return jobs

    @staticmethod
    async def get_job_by_id(job_id: str, user_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        db = get_database()
        query = {"_id": job_id}
        if user_id:
            query["userId"] = user_id

        job_doc = None
        if db is not None:
            try:
                job_doc = await db.jobs.find_one(query)
            except Exception:
                pass

        if not job_doc:
            j = memory_store.get_job(job_id)
            if j and (not user_id or j.get("userId") == user_id):
                job_doc = dict(j)

        if not job_doc:
            return None

        job_doc["id"] = job_doc.get("_id", job_doc.get("id"))

        # Fetch clips
        clips = []
        if db is not None:
            try:
                cursor = db.clips.find({"jobId": job_id}).sort("score", -1)
                async for c in cursor:
                    c["id"] = c.get("_id", c.get("id"))
                    clips.append(c)
            except Exception:
                pass

        if not clips:
            mem_clips = memory_store.get_job_clips(job_id)
            clips = sorted(mem_clips, key=lambda x: x.get("score", 0), reverse=True)

        job_doc["clips"] = clips
        return job_doc

    @staticmethod
    async def get_job_clips(job_id: str, user_id: Optional[str] = None) -> Optional[List[Dict[str, Any]]]:
        db = get_database()
        query = {"_id": job_id}
        if user_id:
            query["userId"] = user_id

        # Verify job ownership / existence
        job_exists = False
        if db is not None:
            try:
                job_doc = await db.jobs.find_one(query)
                if job_doc:
                    job_exists = True
            except Exception:
                pass

        if not job_exists:
            j = memory_store.get_job(job_id)
            if j and (not user_id or j.get("userId") == user_id):
                job_exists = True

        if not job_exists:
            return None

        clips = []
        if db is not None:
            try:
                cursor = db.clips.find({"jobId": job_id}).sort("score", -1)
                async for c in cursor:
                    c["id"] = c.get("_id", c.get("id"))
                    clips.append(c)
            except Exception:
                pass

        if not clips:
            mem_clips = memory_store.get_job_clips(job_id)
            clips = sorted(mem_clips, key=lambda x: x.get("score", 0), reverse=True)

        return clips

    @staticmethod
    async def delete_job(job_id: str, user_id: Optional[str] = None) -> bool:
        db = get_database()
        query = {"_id": job_id}
        if user_id:
            query["userId"] = user_id

        if db is not None:
            try:
                cursor = db.clips.find({"jobId": job_id})
                async for c in cursor:
                    for url_field in [c.get("videoUrl"), c.get("thumbnailUrl")]:
                        if url_field and url_field.startswith("/api/media/"):
                            rel_path = url_field.replace("/api/media/", "")
                            full_p = os.path.join(settings.TEMP_STORAGE_DIR, "public_media", rel_path)
                            if os.path.exists(full_p):
                                try:
                                    os.remove(full_p)
                                except Exception:
                                    pass
                await db.jobs.delete_one(query)
                await db.clips.delete_many({"jobId": job_id})
            except Exception as e:
                logger.warning(f"Error during job deletion: {e}")

        memory_store.delete_job(job_id)
        return True

job_service = JobService()
