import re
import uuid
from datetime import datetime
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks
from app.db.mongodb import get_database
from app.db.memory_store import memory_store
from app.models.admin import AdminResponse, AdminRole
from app.api.admin.auth import get_current_admin, require_roles
from app.queue.redis_queue import queue_instance
from app.workers.video_worker import worker_instance
from app.core.logging import logger
from app.core.utils import format_iso_utc

router = APIRouter(prefix="/jobs", tags=["Admin Jobs"])

def is_client_rendered_job(job_doc: Dict[str, Any]) -> bool:
    """Canonical predicate for detecting client-side/on-device rendered jobs."""
    return bool(
        job_doc.get("videoId") == "client_render"
        or job_doc.get("channel") == "Local Device"
        or job_doc.get("renderMode") == "client"
    )

@router.get("")
async def list_admin_jobs(
    search: Optional[str] = Query(None, description="Search by Job ID, Video Title or YouTube URL"),
    status_filter: Optional[str] = Query(None, alias="status"),
    stage_filter: Optional[str] = Query(None, alias="stage"),
    mode_filter: Optional[str] = Query(None, alias="mode", description="Filter by mode: 'cloud' or 'on-device'"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_admin: AdminResponse = Depends(get_current_admin)
) -> Dict[str, Any]:
    db = get_database()
    skip = (page - 1) * limit

    # ── MongoDB path: native pagination ──────────────────────────────────────
    if db is not None:
        try:
            and_conditions = []
            if status_filter:
                and_conditions.append({"status": status_filter.lower().strip()})
            if stage_filter:
                and_conditions.append({"stage": stage_filter.lower().strip()})
            if mode_filter:
                m = mode_filter.lower().strip()
                if m in ("on-device", "client", "local"):
                    and_conditions.append({
                        "$or": [
                            {"videoId": "client_render"},
                            {"channel": "Local Device"},
                            {"renderMode": "client"}
                        ]
                    })
                elif m == "cloud":
                    and_conditions.append({"videoId": {"$ne": "client_render"}})
                    and_conditions.append({"channel": {"$ne": "Local Device"}})
                    and_conditions.append({"renderMode": {"$ne": "client"}})
            if search:
                s = re.escape(search.strip())
                and_conditions.append({
                    "$or": [
                        {"_id": {"$regex": s, "$options": "i"}},
                        {"title": {"$regex": s, "$options": "i"}},
                        {"youtubeUrl": {"$regex": s, "$options": "i"}},
                    ]
                })

            query = {"$and": and_conditions} if and_conditions else {}

            total = await db.jobs.count_documents(query)
            page_jobs = await db.jobs.find(query).sort("createdAt", -1).skip(skip).limit(limit).to_list(limit)

            # Batch-fetch emails for page-slice only
            user_ids = list({str(j.get("userId")) for j in page_jobs if j.get("userId")})
            user_email_map = {
                str(u["_id"]): u.get("email", "unknown")
                async for u in db.users.find({"_id": {"$in": user_ids}}, {"_id": 1, "email": 1})
            }

            rows = []
            for j in page_jobs:
                jid = str(j.get("_id") or j.get("id"))
                uid = str(j.get("userId", ""))
                st_val = j.get("status", "queued")
                st_clean = st_val.value if hasattr(st_val, "value") else str(st_val)
                stg_val = j.get("stage", "initializing")
                stg_clean = stg_val.value if hasattr(stg_val, "value") else str(stg_val)
                is_client = is_client_rendered_job(j)
                rows.append({
                    "id": jid,
                    "userId": uid,
                    "userEmail": j.get("userEmail") or user_email_map.get(uid, "unknown"),
                    "title": j.get("title", "Untitled Job"),
                    "youtubeUrl": j.get("youtubeUrl", ""),
                    "status": st_clean,
                    "stage": stg_clean,
                    "progress": j.get("progress", 0),
                    "clipCount": j.get("clipCount", 0),
                    "duration": j.get("duration", 0),
                    "processingMode": "on-device" if is_client else "cloud",
                    "isClientRendered": is_client,
                    "createdAt": format_iso_utc(j.get("createdAt")),
                    "completedAt": format_iso_utc(j.get("completedAt")),
                    "error": j.get("error")
                })

            return {
                "jobs": rows,
                "total": total,
                "page": page,
                "limit": limit,
                "pages": (total + limit - 1) // limit
            }

        except Exception as e:
            logger.warning(f"DB job list query failed, using memory store: {e}")

    # ── Memory store fallback ─────────────────────────────────────────────────
    all_jobs = memory_store.get_all_jobs()
    all_users = memory_store.get_all_users()
    user_map = {str(u.get("_id") or u.get("id")): u.get("email") for u in all_users}

    filtered = all_jobs
    if search:
        s = search.lower().strip()
        filtered = [
            j for j in filtered
            if s in str(j.get("id") or j.get("_id")).lower()
            or s in j.get("title", "").lower()
            or s in j.get("youtubeUrl", "").lower()
            or s in str(user_map.get(str(j.get("userId")), "")).lower()
        ]
    if status_filter:
        filtered = [j for j in filtered if str(j.get("status", "")).lower() == status_filter.lower().strip()]
    if stage_filter:
        filtered = [j for j in filtered if str(j.get("stage", "")).lower() == stage_filter.lower().strip()]
    if mode_filter:
        m = mode_filter.lower().strip()
        if m in ("on-device", "client", "local"):
            filtered = [j for j in filtered if is_client_rendered_job(j)]
        elif m == "cloud":
            filtered = [j for j in filtered if not is_client_rendered_job(j)]

    filtered.sort(key=lambda x: str(x.get("createdAt", "")), reverse=True)
    total = len(filtered)
    page_jobs = filtered[skip: skip + limit]

    rows = []
    for j in page_jobs:
        jid = str(j.get("id") or j.get("_id"))
        uid = str(j.get("userId", ""))
        st_val = j.get("status", "queued")
        st_clean = st_val.value if hasattr(st_val, "value") else str(st_val)
        stg_val = j.get("stage", "initializing")
        stg_clean = stg_val.value if hasattr(stg_val, "value") else str(stg_val)
        is_client = is_client_rendered_job(j)
        rows.append({
            "id": jid,
            "userId": uid,
            "userEmail": j.get("userEmail") or user_map.get(uid, "unknown"),
            "title": j.get("title", "Untitled Job"),
            "youtubeUrl": j.get("youtubeUrl", ""),
            "status": st_clean,
            "stage": stg_clean,
            "progress": j.get("progress", 0),
            "clipCount": j.get("clipCount", 0),
            "duration": j.get("duration", 0),
            "processingMode": "on-device" if is_client else "cloud",
            "isClientRendered": is_client,
            "createdAt": format_iso_utc(j.get("createdAt")),
            "completedAt": format_iso_utc(j.get("completedAt")),
            "error": j.get("error")
        })

    return {
        "jobs": rows,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit
    }

@router.get("/{job_id}")
async def get_admin_job_detail(job_id: str, current_admin: AdminResponse = Depends(get_current_admin)) -> Dict[str, Any]:
    db = get_database()
    job_doc = None

    if db is not None:
        try:
            job_doc = await db.jobs.find_one({"_id": job_id})
        except Exception:
            pass

    if not job_doc:
        job_doc = memory_store.get_job(job_id)

    if not job_doc:
        raise HTTPException(status_code=404, detail="Job not found.")

    # Get User
    user_id = str(job_doc.get("userId", ""))
    user_email = "unknown"
    user_doc = memory_store.get_user_by_id(user_id)
    if not user_doc and db is not None:
        try:
            user_doc = await db.users.find_one({"_id": user_id})
        except Exception:
            pass
    if user_doc:
        user_email = user_doc.get("email", "unknown")

    # Get Clips
    clips = memory_store.get_job_clips(job_id)
    if db is not None:
        try:
            mongo_clips = await db.clips.find({"jobId": job_id}).to_list(100)
            if mongo_clips:
                clips = mongo_clips
        except Exception:
            pass

    # Build Pipeline Stage History
    stages = [
        {"name": "Queued", "key": "queued", "done": True},
        {"name": "Fetching Metadata", "key": "fetching", "done": job_doc.get("progress", 0) >= 15 or job_doc.get("status") == "completed"},
        {"name": "Transcribing Audio", "key": "transcribing", "done": job_doc.get("progress", 0) >= 35 or job_doc.get("status") == "completed"},
        {"name": "AI Moment Analysis", "key": "analyzing", "done": job_doc.get("progress", 0) >= 60 or job_doc.get("status") == "completed"},
        {"name": "Moment Selection", "key": "selecting", "done": job_doc.get("progress", 0) >= 75 or job_doc.get("status") == "completed"},
        {"name": "FFmpeg 9:16 Render", "key": "rendering", "done": job_doc.get("progress", 0) >= 90 or job_doc.get("status") == "completed"},
        {"name": "Cloudinary Upload", "key": "uploading", "done": job_doc.get("progress", 0) >= 98 or job_doc.get("status") == "completed"},
        {"name": "Finalized", "key": "finalizing", "done": job_doc.get("status") == "completed"}
    ]

    # Synthesize Job Logs
    logs = [
        {"timestamp": format_iso_utc(job_doc.get("createdAt")), "message": "Job registered in queue dispatch."},
        {"timestamp": format_iso_utc(job_doc.get("startedAt") or job_doc.get("createdAt")), "message": "Worker thread acquired video metadata."}
    ]
    if job_doc.get("progress", 0) >= 35 or job_doc.get("status") == "completed":
        logs.append({"timestamp": format_iso_utc(job_doc.get("startedAt") or job_doc.get("createdAt")), "message": "Audio stream parsed with fast transcription model."})
    if job_doc.get("progress", 0) >= 60 or job_doc.get("status") == "completed":
        logs.append({"timestamp": format_iso_utc(job_doc.get("startedAt") or job_doc.get("createdAt")), "message": "Groq AI identified peak retention moment boundaries."})
    if job_doc.get("progress", 0) >= 90 or job_doc.get("status") == "completed":
        logs.append({"timestamp": format_iso_utc(job_doc.get("startedAt") or job_doc.get("createdAt")), "message": f"FFmpeg rendered {len(clips)} vertical short clips with burned subtitles."})
    if job_doc.get("status") == "completed":
        logs.append({"timestamp": format_iso_utc(job_doc.get("completedAt")), "message": "Job finished successfully."})
    if job_doc.get("error"):
        logs.append({"timestamp": format_iso_utc(job_doc.get("updatedAt") or job_doc.get("createdAt")), "message": f"ERROR: {job_doc.get('error')}"})

    is_client = (
        job_doc.get("videoId") == "client_render"
        or job_doc.get("channel") == "Local Device"
        or job_doc.get("renderMode") == "client"
    )

    return {
        "job": {
            "id": str(job_doc.get("id") or job_doc.get("_id")),
            "userId": user_id,
            "userEmail": user_email,
            "youtubeUrl": job_doc.get("youtubeUrl"),
            "videoId": job_doc.get("videoId"),
            "title": job_doc.get("title", "Untitled Job"),
            "thumbnail": job_doc.get("thumbnail"),
            "duration": job_doc.get("duration", 0),
            "status": job_doc.get("status", "queued"),
            "stage": job_doc.get("stage", "initializing"),
            "progress": job_doc.get("progress", 0),
            "clipCount": job_doc.get("clipCount", 0),
            "processingMode": "on-device" if is_client else "cloud",
            "isClientRendered": is_client,
            "settings": job_doc.get("settings", {}),
            "createdAt": format_iso_utc(job_doc.get("createdAt")),
            "startedAt": format_iso_utc(job_doc.get("startedAt")),
            "completedAt": format_iso_utc(job_doc.get("completedAt")),
            "error": job_doc.get("error")
        },
        "stages": stages,
        "logs": logs,
        "clips": [
            {
                "id": str(c.get("id") or c.get("_id")),
                "title": c.get("title", "Clip"),
                "hook": c.get("hook", ""),
                "duration": c.get("duration", 0),
                "startTime": c.get("startTime", 0),
                "endTime": c.get("endTime", 0),
                "score": c.get("score", 90),
                "videoUrl": c.get("videoUrl"),
                "thumbnailUrl": c.get("thumbnailUrl"),
                "createdAt": str(c.get("createdAt", ""))
            }
            for c in clips
        ]
    }

@router.post("/{job_id}/retry")
async def retry_job(
    job_id: str,
    background_tasks: BackgroundTasks,
    current_admin: AdminResponse = Depends(require_roles([AdminRole.SUPER_ADMIN, AdminRole.ADMIN]))
):
    db = get_database()
    job_doc = memory_store.get_job(job_id)
    if not job_doc and db is not None:
        try:
            job_doc = await db.jobs.find_one({"_id": job_id})
        except Exception:
            pass

    if not job_doc:
        raise HTTPException(status_code=404, detail="Job not found.")

    raw_settings = job_doc.get("settings")
    if hasattr(raw_settings, "model_dump"):
        settings_dict = raw_settings.model_dump()
    elif hasattr(raw_settings, "dict"):
        settings_dict = raw_settings.dict()
    elif isinstance(raw_settings, dict):
        settings_dict = raw_settings
    else:
        settings_dict = {}

    youtube_url = job_doc.get("youtubeUrl")
    source_video_path = job_doc.get("sourceVideoPath")
    source_type = job_doc.get("sourceType", "youtube")
    is_client_rendered = job_doc.get("videoId") == "client_render" or job_doc.get("channel") == "Local Device"

    # Client-rendered jobs only send audio to the server for planning; the raw video is never uploaded.
    # Therefore, the server cannot re-render client jobs.
    if is_client_rendered or (not youtube_url and not source_video_path):
        raise HTTPException(
            status_code=400,
            detail="Client-rendered jobs cannot be retried on the server because the raw video remained on the user's local device."
        )

    now = datetime.utcnow()
    reset_data = {
        "status": "queued",
        "stage": "initializing",
        "progress": 5,
        "error": None,
        "startedAt": now,
        "completedAt": None,
        "updatedAt": now
    }

    memory_store.update_job(job_id, reset_data)
    if db is not None:
        try:
            await db.jobs.update_one({"_id": job_id}, {"$set": reset_data})
        except Exception:
            pass

    # Launch worker — reconstruct full payload from job_doc
    payload = {
        "jobId": job_id,
        "userId": job_doc.get("userId"),
        "youtubeUrl": youtube_url,
        "videoId": job_doc.get("videoId"),
        "sourceType": source_type,
        "sourceVideoPath": source_video_path,
        "clipCount": job_doc.get("clipCount") or settings_dict.get("clipCount", 5),
        "minDuration": settings_dict.get("minDuration", 15),
        "maxDuration": settings_dict.get("maxDuration", 60),
        "format": settings_dict.get("format", "mp4"),
        "captions": settings_dict.get("captions", True),
        "saveToCloud": settings_dict.get("saveToCloud", True),
        "estimatedSeconds": job_doc.get("estimatedSeconds", 60),
    }
    if queue_instance.is_connected:
        await queue_instance.enqueue_job(job_id, payload)
    else:
        background_tasks.add_task(worker_instance.process_job, job_id, payload)

    # Record Audit
    memory_store.add_audit_log({
        "id": f"audit_{uuid.uuid4().hex[:12]}",
        "adminId": current_admin.id,
        "adminEmail": current_admin.email,
        "action": "JOB_RETRIED",
        "targetType": "JOB",
        "targetId": job_id,
        "metadata": {"title": job_doc.get("title")},
        "createdAt": now
    })

    logger.info(f"Job {job_id} retried by Admin {current_admin.email}")
    return {"message": "Job requeued for processing.", "jobId": job_id, "status": "queued"}

@router.post("/{job_id}/cancel")
async def cancel_job(
    job_id: str,
    current_admin: AdminResponse = Depends(require_roles([AdminRole.SUPER_ADMIN, AdminRole.ADMIN]))
):
    db = get_database()
    now = datetime.utcnow()
    cancel_data = {
        "status": "cancelled",
        "stage": "cancelled",
        "error": f"Cancelled by administrator ({current_admin.email})",
        "completedAt": now,
        "updatedAt": now
    }

    memory_store.update_job(job_id, cancel_data)
    if db is not None:
        try:
            await db.jobs.update_one({"_id": job_id}, {"$set": cancel_data})
        except Exception:
            pass

    # Record Audit
    memory_store.add_audit_log({
        "id": f"audit_{uuid.uuid4().hex[:12]}",
        "adminId": current_admin.id,
        "adminEmail": current_admin.email,
        "action": "JOB_CANCELLED",
        "targetType": "JOB",
        "targetId": job_id,
        "metadata": {},
        "createdAt": now
    })

    logger.info(f"Job {job_id} cancelled by Admin {current_admin.email}")
    return {"message": "Job cancelled.", "jobId": job_id, "status": "cancelled"}

@router.post("/purge-stale")
async def purge_stale_jobs(
    max_age_minutes: int = Query(20, ge=1, le=1440, description="Age in minutes past which stuck jobs are marked failed"),
    current_admin: AdminResponse = Depends(require_roles([AdminRole.SUPER_ADMIN, AdminRole.ADMIN]))
):
    """Admin tool to immediately sweep and mark all zombie/stuck jobs as failed."""
    from datetime import datetime, timedelta
    cutoff = datetime.utcnow() - timedelta(minutes=max_age_minutes)
    stuck_statuses = ["queued", "processing", "fetching", "transcribing", "analyzing", "rendering", "uploading"]
    db = get_database()
    reaped_count = 0

    if db is not None:
        try:
            res = await db.jobs.update_many(
                {
                    "status": {"$in": stuck_statuses},
                    "$or": [
                        {"updatedAt": {"$lt": cutoff}},
                        {"updatedAt": {"$exists": False}, "createdAt": {"$lt": cutoff}},
                        {"updatedAt": None, "createdAt": {"$lt": cutoff}}
                    ]
                },
                {
                    "$set": {
                        "status": "failed",
                        "stage": "finalizing",
                        "error": f"Job reaped by Admin {current_admin.email} (timed out after {max_age_minutes}m).",
                        "completedAt": datetime.utcnow(),
                        "updatedAt": datetime.utcnow()
                    }
                }
            )
            reaped_count = res.modified_count
        except Exception as e:
            logger.error(f"Failed to purge stale jobs: {e}")

    for jid, j in list(memory_store.jobs.items()):
        st = str(j.get("status", "")).lower()
        if st in stuck_statuses:
            dt = j.get("updatedAt") or j.get("createdAt")
            if isinstance(dt, datetime) and dt < cutoff:
                memory_store.update_job(jid, {
                    "status": "failed",
                    "stage": "finalizing",
                    "error": f"Job reaped by Admin {current_admin.email} (timed out).",
                    "completedAt": datetime.utcnow(),
                    "updatedAt": datetime.utcnow()
                })
                reaped_count += 1

    memory_store.add_audit_log({
        "id": f"audit_{uuid.uuid4().hex[:12]}",
        "adminId": current_admin.id,
        "adminEmail": current_admin.email,
        "action": "JOB_PURGED",
        "targetType": "SYSTEM",
        "targetId": "jobs_queue",
        "metadata": {"reapedCount": reaped_count, "maxAgeMinutes": max_age_minutes},
        "createdAt": datetime.utcnow()
    })

    return {
        "message": f"Successfully cleared {reaped_count} stuck jobs.",
        "reapedCount": reaped_count,
        "cutoff": cutoff.isoformat()
    }
