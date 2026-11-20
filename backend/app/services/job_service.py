import os
import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any
from app.core.config import settings
from app.db.mongodb import get_database
from app.db.memory_store import memory_store
from app.models.job import JobCreateRequest, JobStatus, JobStage
from app.queue.redis_queue import queue_instance
from app.core.utils import extract_youtube_id, utc_now
from app.core.logging import logger

class JobService:
    @staticmethod
    async def create_job(
        req: JobCreateRequest,
        user_id: str,
        background_tasks_handler=None,
        client_ip: Optional[str] = None
    ) -> Dict[str, Any]:
        video_id = extract_youtube_id(req.youtubeUrl or "")
        if req.sourceType == "youtube" and not video_id:
            raise ValueError("Please enter a valid YouTube video URL.")

        canonical_youtube_url = f"https://www.youtube.com/watch?v={video_id}" if video_id else None
        job_id = f"job_{uuid.uuid4().hex[:12]}"
        now = utc_now()
        estimated_seconds = 15 + (req.clipCount * 8)

        job_doc = {
            "_id": job_id,
            "id": job_id,
            "userId": user_id,
            "youtubeUrl": canonical_youtube_url,
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
            "youtubeUrl": canonical_youtube_url,
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
        # If Redis queue is offline, execute in-process via background tasks as fallback
        if not queue_instance.is_connected and background_tasks_handler:
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
        now = utc_now()
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
        # If Redis queue is offline, execute in-process via background tasks as fallback
        if not queue_instance.is_connected and background_tasks_handler:
            from app.workers.video_worker import worker_instance
            background_tasks_handler.add_task(worker_instance.process_job, job_id, payload)

        logger.info(f"Created upload video clipping job {job_id} for user {user_id}")
        return job_doc

    @staticmethod
    async def get_user_jobs(user_id: str, limit: Optional[int] = None, skip: int = 0) -> List[Dict[str, Any]]:
        db = get_database()
        jobs = []
        if db is not None:
            try:
                query = db.jobs.find({"userId": user_id}).sort("createdAt", -1).skip(skip)
                if limit:
                    query = query.limit(limit)
                jobs = await query.to_list(limit or 500)
                if not jobs:
                    return []

                job_ids = [str(j.get("_id") or j.get("id")) for j in jobs]
                
                # Single batched query to fetch all clips for all jobs in 1 round-trip (O(1) round trips)
                clips_cursor = db.clips.find({"jobId": {"$in": job_ids}}).sort("score", -1)
                clips_by_job: Dict[str, list] = {jid: [] for jid in job_ids}
                async for c in clips_cursor:
                    c["id"] = str(c.get("_id") or c.get("id"))
                    jid = str(c.get("jobId", ""))
                    if jid in clips_by_job:
                        clips_by_job[jid].append(c)

                for j in jobs:
                    j["id"] = str(j.get("_id") or j.get("id"))
                    j["clips"] = clips_by_job.get(j["id"], [])
                return jobs
            except Exception as e:
                logger.warning(f"Batched get_user_jobs notice: {e}")

        for j in memory_store.jobs.values():
            if j.get("userId") == user_id:
                c = dict(j)
                c["id"] = c.get("_id", c.get("id"))
                if not c.get("clips"):
                    c["clips"] = memory_store.get_job_clips(c["id"])
                jobs.append(c)
        jobs.sort(key=lambda x: str(x.get("createdAt", "")), reverse=True)
        if limit:
            return jobs[skip:skip+limit]
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
                public_media_root = os.path.abspath(os.path.join(settings.TEMP_STORAGE_DIR, "public_media"))
                cursor = db.clips.find({"jobId": job_id})
                async for c in cursor:
                    for url_field in [c.get("videoUrl"), c.get("thumbnailUrl")]:
                        if url_field and url_field.startswith("/api/media/"):
                            rel_path = url_field.replace("/api/media/", "").lstrip("/\\")
                            full_p = os.path.abspath(os.path.join(public_media_root, rel_path))
                            if full_p.startswith(public_media_root + os.sep) and os.path.isfile(full_p):
                                try:
                                    os.remove(full_p)
                                except OSError as e:
                                    logger.warning(f"Failed to remove clip file {full_p}: {e}")
                await db.jobs.delete_one(query)
                await db.clips.delete_many({"jobId": job_id})
            except Exception as e:
                logger.warning(f"Error during job deletion: {e}")

        memory_store.delete_job(job_id)
        return True

job_service = JobService()
