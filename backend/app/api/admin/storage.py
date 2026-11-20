import os
import shutil
import uuid
import asyncio
from datetime import datetime
from typing import Dict, Any, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, Query
from app.core.config import settings
from app.db.mongodb import get_database
from app.db.memory_store import memory_store
from app.models.admin import AdminResponse, AdminRole
from app.api.admin.auth import get_current_admin, require_roles
from app.core.utils import utc_now
from app.core.logging import logger

router = APIRouter(prefix="/storage", tags=["Admin Storage"])

def _scan_dir(temp_dir: str):
    temp_bytes = 0
    temp_files_count = 0
    if os.path.exists(temp_dir):
        for root, dirs, files in os.walk(temp_dir):
            for f in files:
                fp = os.path.join(root, f)
                try:
                    temp_bytes += os.path.getsize(fp)
                    temp_files_count += 1
                except Exception:
                    pass
    return temp_bytes, temp_files_count

@router.get("")
async def get_storage_overview(current_admin: AdminResponse = Depends(get_current_admin)) -> Dict[str, Any]:
    db = get_database()
    clips_count = len(memory_store.get_all_clips())
    jobs_count = len(memory_store.get_all_jobs())

    if db is not None:
        try:
            clips_count = await db.clips.count_documents({})
            jobs_count = await db.jobs.count_documents({})
        except Exception:
            pass

    # Local temp storage folder calculation via async worker thread
    temp_dir = settings.TEMP_STORAGE_DIR
    temp_bytes, temp_files_count = await asyncio.to_thread(_scan_dir, temp_dir)

    # Estimated sizes
    clip_bytes = clips_count * 12 * 1024 * 1024
    thumb_bytes = jobs_count * 400 * 1024
    total_bytes = clip_bytes + thumb_bytes + temp_bytes

    # Orphaned / real reclaimable media calculation
    reclaimable_bytes = temp_bytes
    reclaimable_formatted = f"{round(reclaimable_bytes / (1024 * 1024), 2)} MB"

    # Database (MongoDB) metrics
    all_users = memory_store.get_all_users()
    users_count = len(all_users)
    mongo_connected = db is not None
    mongo_db_name = settings.MONGODB_DB_NAME
    if db is not None:
        try:
            users_count = await db.users.count_documents({})
        except Exception:
            pass

    mongo_doc_count = users_count + jobs_count + clips_count
    # Estimated metadata storage in bytes (~2KB per document)
    mongo_bytes = mongo_doc_count * 2048

    cdn_bytes = clip_bytes + thumb_bytes
    cdn_formatted = f"{round(cdn_bytes / (1024 * 1024), 1)} MB"

    return {
        "summary": {
            "totalBytes": total_bytes,
            "totalFormatted": f"{round(total_bytes / (1024 * 1024), 2)} MB" if total_bytes < (1024*1024*1024) else f"{round(total_bytes / (1024 * 1024 * 1024), 2)} GB",
            "clipStorageBytes": clip_bytes,
            "clipStorageFormatted": f"{round(clip_bytes / (1024 * 1024), 1)} MB",
            "thumbnailStorageBytes": thumb_bytes,
            "thumbnailStorageFormatted": f"{round(thumb_bytes / (1024 * 1024), 1)} MB",
            "tempCacheBytes": temp_bytes,
            "tempCacheFormatted": f"{round(temp_bytes / (1024 * 1024), 1)} MB"
        },
        "counts": {
            "clips": clips_count,
            "thumbnails": jobs_count,
            "tempFiles": temp_files_count
        },
        "cleanupPreview": {
            "orphanedFailedMediaCount": 0,
            "orphanedFailedMediaBytes": reclaimable_bytes,
            "orphanedFormatted": reclaimable_formatted,
            "tempFilesCount": temp_files_count,
            "tempFilesBytes": temp_bytes
        },
        "cloudinary": {
            "configured": bool(settings.CLOUDINARY_CLOUD_NAME and settings.CLOUDINARY_API_KEY),
            "cloudName": settings.CLOUDINARY_CLOUD_NAME or "local_mode"
        },
        "layers": {
            "cdn": {
                "name": "Cloudinary CDN & Media Storage",
                "type": "CDN / Cloud Media Storage",
                "purpose": "Stores high-speed MP4 vertical videos & image thumbnails for user delivery",
                "provider": settings.CLOUDINARY_CLOUD_NAME or "Cloudinary CDN",
                "bytes": cdn_bytes,
                "formatted": cdn_formatted,
                "clipFiles": clips_count,
                "thumbFiles": jobs_count,
                "status": "active"
            },
            "mongodb": {
                "name": "MongoDB Database",
                "type": "NoSQL Document Database",
                "purpose": "Stores user accounts, job history, moment timestamps, hooks & viral scores",
                "database": mongo_db_name,
                "connected": mongo_connected,
                "totalDocuments": mongo_doc_count,
                "collections": {
                    "users": users_count,
                    "jobs": jobs_count,
                    "clips": clips_count
                },
                "bytes": mongo_bytes,
                "formatted": f"{round(mongo_bytes / 1024, 1)} KB" if mongo_bytes < 1024*1024 else f"{round(mongo_bytes / (1024*1024), 2)} MB"
            },
            "diskCache": {
                "name": "Server Local Disk Scratch (Cleanup Target)",
                "type": "Temporary Scratch Directory (./tmp_media)",
                "purpose": "Intermediate FFmpeg transcode chunks & upload buffers (Safe to purge)",
                "bytes": temp_bytes,
                "formatted": f"{round(temp_bytes / (1024 * 1024), 1)} MB",
                "fileCount": temp_files_count,
                "cleanupTarget": True
            }
        }
    }

class StorageCleanupRequest(BaseModel):
    category: str = "temp"

@router.post("/cleanup")
@router.post("/cleanup/")
async def trigger_storage_cleanup(
    body: Optional[StorageCleanupRequest] = None,
    category: Optional[str] = Query(None),
    current_admin: AdminResponse = Depends(require_roles([AdminRole.SUPER_ADMIN, AdminRole.ADMIN]))
):
    target = (category or (body.category if body else None) or "temp").lower().strip()
    
    # Destructive purge actions require SUPER_ADMIN authorization
    if target in ["database", "db", "clips", "all"] and current_admin.role != AdminRole.SUPER_ADMIN:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Super Admins are authorized to purge database history or rendered media clips."
        )

    db = get_database()
    temp_dir = settings.TEMP_STORAGE_DIR

    cleaned_files = 0
    cleaned_bytes = 0
    actions_taken = []

    # 1. PURGE SCRATCH TEMP FILES (if target is "temp" or "all")
    if target in ["temp", "scratch", "all"]:
        from app.core.utils import cleanup_orphaned_temp_files
        def _clean_temp_sync():
            c_files = cleanup_orphaned_temp_files(temp_dir, max_age_hours=6.0)
            c_bytes = 0
            uploads_dir = os.path.join(temp_dir, "uploads")
            if os.path.exists(uploads_dir):
                for f in os.listdir(uploads_dir):
                    fp = os.path.join(uploads_dir, f)
                    try:
                        if os.path.isfile(fp):
                            c_bytes += os.path.getsize(fp)
                            os.remove(fp)
                            c_files += 1
                    except Exception:
                        pass
            return c_files, c_bytes

        temp_cleaned, add_bytes = await asyncio.to_thread(_clean_temp_sync)
        cleaned_bytes += add_bytes
        cleaned_files += temp_cleaned
        actions_taken.append(f"Purged {temp_cleaned} scratch & upload temp files")

    # 2. PURGE THUMBNAILS (if target is "thumbnails" or "all")
    if target in ["thumbnails", "all"]:
        # Cloudinary CDN cleanup
        if settings.CLOUDINARY_CLOUD_NAME and settings.CLOUDINARY_API_KEY:
            try:
                import cloudinary.api
                await asyncio.to_thread(cloudinary.api.delete_resources_by_prefix, "ai-video-clipper/thumbnails")
            except Exception as e:
                logger.warning(f"Cloudinary thumbnail deletion notice: {e}")
        # Local thumbnail folder cleanup
        local_thumbs = os.path.join(temp_dir, "public_media", "thumbnails")
        if os.path.exists(local_thumbs):
            try:
                shutil.rmtree(local_thumbs, ignore_errors=True)
            except Exception:
                pass
        # Unset thumbnail URLs on jobs in DB and memory
        if db is not None:
            try:
                thumb_res = await db.jobs.update_many({}, {"$set": {"thumbnail": None}})
                cleaned_files += thumb_res.modified_count
                cleaned_bytes += thumb_res.modified_count * 400 * 1024
            except Exception:
                pass
        for j in memory_store.get_all_jobs():
            memory_store.update_job(j.get("id"), {"thumbnail": None})
        actions_taken.append("Cleaned thumbnail image covers from CDN and database")

    # 3. PURGE RENDERED CLIPS (if target is "clips" or "all")
    if target in ["clips", "all"]:
        if settings.CLOUDINARY_CLOUD_NAME and settings.CLOUDINARY_API_KEY:
            try:
                import cloudinary.api
                await asyncio.to_thread(cloudinary.api.delete_resources_by_prefix, "ai-video-clipper/clips", resource_type="video")
            except Exception as e:
                logger.warning(f"Cloudinary clip video deletion notice: {e}")
        local_clips = os.path.join(temp_dir, "public_media", "clips")
        if os.path.exists(local_clips):
            try:
                shutil.rmtree(local_clips, ignore_errors=True)
            except Exception:
                pass
        clips_deleted = 0
        if db is not None:
            try:
                c_res = await db.clips.delete_many({})
                clips_deleted = c_res.deleted_count
                await db.jobs.update_many({}, {"$set": {"clips": [], "clipCount": 0}})
            except Exception:
                pass
        cleaned_files += clips_deleted
        cleaned_bytes += clips_deleted * 12 * 1024 * 1024
        memory_store.clips.clear()
        actions_taken.append(f"Deleted {clips_deleted} rendered MP4 video clips from CDN & records")

    # 4. PRUNE DATABASE JOB HISTORY (if target is "database" or "all")
    if target in ["database", "db", "all"]:
        jobs_pruned = 0
        if db is not None:
            try:
                j_res = await db.jobs.delete_many({"status": {"$in": ["completed", "failed", "cancelled"]}})
                jobs_pruned = j_res.deleted_count
                # Clean orphan clips across all active jobs safely without arbitrary limit
                active_job_ids = await db.jobs.distinct("_id")
                await db.clips.delete_many({"jobId": {"$nin": active_job_ids}})
            except Exception:
                pass
        for j in list(memory_store.get_all_jobs()):
            if j.get("status") in ["completed", "failed", "cancelled"]:
                memory_store.jobs.pop(j.get("id"), None)
        cleaned_bytes += jobs_pruned * 2048
        actions_taken.append(f"Pruned {jobs_pruned} finished job logs from MongoDB (User accounts kept safe)")

    # Record Audit
    now = utc_now()
    memory_store.add_audit_log({
        "id": f"audit_{uuid.uuid4().hex[:12]}",
        "adminId": current_admin.id,
        "adminEmail": current_admin.email,
        "action": "STORAGE_CLEANUP",
        "targetType": "STORAGE",
        "targetId": target,
        "metadata": {"category": target, "cleanedFiles": cleaned_files, "cleanedBytes": cleaned_bytes, "actions": actions_taken},
        "createdAt": now
    })

    logger.info(f"Storage cleanup ({target}) executed by {current_admin.email}: {', '.join(actions_taken)}")
    summary_msg = "; ".join(actions_taken) if actions_taken else "Targeted storage is already clean."
    return {
        "message": summary_msg,
        "category": target,
        "cleanedFiles": cleaned_files,
        "cleanedBytes": cleaned_bytes,
        "cleanedFormatted": f"{round(cleaned_bytes / (1024 * 1024), 2)} MB" if cleaned_bytes >= 1024*1024 else f"{round(cleaned_bytes / 1024, 1)} KB"
    }
