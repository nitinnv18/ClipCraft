import os
import uuid
from datetime import datetime
from typing import Dict, Any, List
from fastapi import APIRouter, HTTPException, Depends
from app.core.config import settings
from app.db.mongodb import get_database
from app.db.memory_store import memory_store
from app.models.admin import AdminResponse, AdminRole
from app.api.admin.auth import get_current_admin, require_roles
from app.core.logging import logger

router = APIRouter(prefix="/storage", tags=["Admin Storage"])

@router.get("")
async def get_storage_overview(current_admin: AdminResponse = Depends(get_current_admin)) -> Dict[str, Any]:
    db = get_database()
    all_clips = memory_store.get_all_clips()
    all_jobs = memory_store.get_all_jobs()

    if db is not None:
        try:
            mongo_clips = await db.clips.find({}).to_list(10000)
            if mongo_clips:
                all_clips = mongo_clips
            mongo_jobs = await db.jobs.find({}).to_list(10000)
            if mongo_jobs:
                all_jobs = mongo_jobs
        except Exception:
            pass

    # Real storage calculation
    clips_count = len(all_clips)
    jobs_count = len(all_jobs)

    # Local temp storage folder calculation
    temp_dir = settings.TEMP_STORAGE_DIR
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

    # Estimated sizes
    clip_bytes = clips_count * 12 * 1024 * 1024
    thumb_bytes = jobs_count * 400 * 1024
    total_bytes = clip_bytes + thumb_bytes + temp_bytes

    # Orphaned / failed media estimation
    failed_jobs = [j for j in all_jobs if j.get("status") in ["failed", "error", "cancelled"]]
    orphaned_est_count = len(failed_jobs)
    orphaned_est_bytes = orphaned_est_count * 5 * 1024 * 1024

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
            "orphanedFailedMediaCount": orphaned_est_count,
            "orphanedFailedMediaBytes": orphaned_est_bytes,
            "orphanedFormatted": f"{round(orphaned_est_bytes / (1024 * 1024), 1)} MB",
            "tempFilesCount": temp_files_count,
            "tempFilesBytes": temp_bytes
        },
        "cloudinary": {
            "configured": bool(settings.CLOUDINARY_CLOUD_NAME and settings.CLOUDINARY_API_KEY),
            "cloudName": settings.CLOUDINARY_CLOUD_NAME or "local_mode"
        }
    }

@router.post("/cleanup")
async def trigger_storage_cleanup(
    category: str = "all",
    current_admin: AdminResponse = Depends(require_roles([AdminRole.SUPER_ADMIN, AdminRole.ADMIN]))
):
    cleaned_bytes = 0
    cleaned_files = 0
    temp_dir = settings.TEMP_STORAGE_DIR

    # Clean local temp files if exists
    if os.path.exists(temp_dir):
        for root, dirs, files in os.walk(temp_dir):
            for f in files:
                fp = os.path.join(root, f)
                try:
                    sz = os.path.getsize(fp)
                    os.remove(fp)
                    cleaned_bytes += sz
                    cleaned_files += 1
                except Exception:
                    pass

    # Record Audit
    now = datetime.utcnow()
    memory_store.add_audit_log({
        "id": f"audit_{uuid.uuid4().hex[:12]}",
        "adminId": current_admin.id,
        "adminEmail": current_admin.email,
        "action": "STORAGE_CLEANUP",
        "targetType": "STORAGE",
        "targetId": category,
        "metadata": {"cleanedFiles": cleaned_files, "cleanedBytes": cleaned_bytes},
        "createdAt": now
    })

    logger.info(f"Storage cleanup executed by {current_admin.email}: {cleaned_files} files ({cleaned_bytes} bytes)")
    return {
        "message": "Storage cleanup completed successfully.",
        "cleanedFiles": cleaned_files,
        "cleanedBytes": cleaned_bytes,
        "cleanedFormatted": f"{round(cleaned_bytes / (1024 * 1024), 2)} MB"
    }
