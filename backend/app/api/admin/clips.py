import os
import uuid
from datetime import datetime
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Query
from app.core.config import settings
from app.db.mongodb import get_database
from app.db.memory_store import memory_store
from app.models.admin import AdminResponse, AdminRole
from app.api.admin.auth import get_current_admin, require_roles
from app.core.logging import logger
from app.core.utils import format_iso_utc
from app.providers.storage.cloudinary_provider import cloudinary_provider

router = APIRouter(prefix="/clips", tags=["Admin Clips"])

@router.get("")
async def list_admin_clips(
    search: Optional[str] = Query(None, description="Search by Clip Title, Hook, Job ID or User ID"),
    min_score: Optional[int] = Query(None, ge=0, le=100),
    page: int = Query(1, ge=1),
    limit: int = Query(24, ge=1, le=100),
    current_admin: AdminResponse = Depends(get_current_admin)
) -> Dict[str, Any]:
    db = get_database()
    skip = (page - 1) * limit

    # Native database-level pagination to prevent RAM spikes / OOM DoS
    if db is not None:
        try:
            query: Dict[str, Any] = {}
            if min_score is not None:
                query["score"] = {"$gte": min_score}
            if search:
                import re
                safe_s = re.escape(search.strip())
                query["$or"] = [
                    {"title": {"$regex": safe_s, "$options": "i"}},
                    {"hook": {"$regex": safe_s, "$options": "i"}},
                    {"jobId": {"$regex": safe_s, "$options": "i"}},
                    {"userId": {"$regex": safe_s, "$options": "i"}},
                ]

            total = await db.clips.count_documents(query)
            page_clips = await db.clips.find(query).sort("createdAt", -1).skip(skip).limit(limit).to_list(limit)

            # Query only the users and jobs referenced on this specific page (max 24)
            clip_uids = list({str(c.get("userId")) for c in page_clips if c.get("userId")})
            clip_jids = list({str(c.get("jobId")) for c in page_clips if c.get("jobId")})

            user_docs = await db.users.find({"_id": {"$in": clip_uids}}, {"_id": 1, "email": 1}).to_list(100) if clip_uids else []
            job_docs = await db.jobs.find({"_id": {"$in": clip_jids}}, {"_id": 1, "title": 1}).to_list(100) if clip_jids else []

            user_map = {str(u["_id"]): u.get("email") for u in user_docs}
            job_map = {str(j["_id"]): j.get("title") for j in job_docs}

            rows = []
            for c in page_clips:
                uid = str(c.get("userId", ""))
                jid = str(c.get("jobId", ""))
                rows.append({
                    "id": str(c.get("id") or c.get("_id")),
                    "jobId": jid,
                    "jobTitle": job_map.get(jid) or c.get("jobTitle") or "ClipCraft Video",
                    "userId": uid,
                    "userEmail": user_map.get(uid) or c.get("userEmail") or "User",
                    "title": c.get("title", "Untitled Clip"),
                    "hook": c.get("hook", ""),
                    "duration": c.get("duration", 0),
                    "startTime": c.get("startTime", 0),
                    "endTime": c.get("endTime", 0),
                    "score": c.get("score", 90),
                    "videoUrl": c.get("videoUrl", ""),
                    "thumbnailUrl": c.get("thumbnailUrl", ""),
                    "cloudinaryPublicId": c.get("cloudinaryPublicId"),
                    "createdAt": format_iso_utc(c.get("createdAt"))
                })

            return {
                "clips": rows,
                "total": total,
                "page": page,
                "limit": limit,
                "pages": (total + limit - 1) // limit
            }
        except Exception as e:
            logger.warning(f"DB clips query error, falling back to memory store: {e}")

    # Memory store fallback (for offline or local dev without MongoDB)
    all_clips = memory_store.get_all_clips()
    all_jobs = memory_store.get_all_jobs()
    all_users = memory_store.get_all_users()

    user_map = {str(u.get("_id") or u.get("id")): u.get("email") for u in all_users}
    job_map = {str(j.get("_id") or j.get("id")): j.get("title") for j in all_jobs}

    filtered = all_clips
    if search:
        s = search.lower().strip()
        filtered = [
            c for c in filtered
            if s in str(c.get("title", "")).lower()
            or s in str(c.get("hook", "")).lower()
            or s in str(c.get("jobId", "")).lower()
            or s in str(c.get("userId", "")).lower()
            or s in str(user_map.get(str(c.get("userId")), "")).lower()
        ]

    if min_score is not None:
        filtered = [c for c in filtered if (c.get("score") or 0) >= min_score]

    filtered.sort(key=lambda x: str(x.get("createdAt", "")), reverse=True)

    total = len(filtered)
    start_idx = (page - 1) * limit
    page_clips = filtered[start_idx : start_idx + limit]

    rows = []
    for c in page_clips:
        cid = str(c.get("id") or c.get("_id"))
        uid = str(c.get("userId", ""))
        jid = str(c.get("jobId", ""))
        rows.append({
            "id": cid,
            "jobId": jid,
            "jobTitle": job_map.get(jid, "Untitled Source"),
            "userId": uid,
            "userEmail": user_map.get(uid, "unknown"),
            "title": c.get("title", "Untitled Clip"),
            "hook": c.get("hook", ""),
            "duration": c.get("duration", 0),
            "startTime": c.get("startTime", 0),
            "endTime": c.get("endTime", 0),
            "score": c.get("score", 90),
            "videoUrl": c.get("videoUrl", ""),
            "thumbnailUrl": c.get("thumbnailUrl", ""),
            "cloudinaryPublicId": c.get("cloudinaryPublicId"),
            "createdAt": format_iso_utc(c.get("createdAt"))
        })

    return {
        "clips": rows,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit
    }

@router.delete("/{clip_id}")
async def delete_clip(
    clip_id: str,
    current_admin: AdminResponse = Depends(require_roles([AdminRole.SUPER_ADMIN, AdminRole.ADMIN]))
):
    db = get_database()
    clip_doc = memory_store.get_clip(clip_id)
    if not clip_doc and db is not None:
        try:
            clip_doc = await db.clips.find_one({"_id": clip_id})
        except Exception:
            pass

    if not clip_doc:
        raise HTTPException(status_code=404, detail="Clip not found.")

    # 1. Clean up remote Cloudinary asset if present
    pub_id = clip_doc.get("cloudinaryPublicId")
    if pub_id:
        try:
            await cloudinary_provider.delete_file(pub_id)
        except Exception as e:
            logger.warning(f"Failed to delete Cloudinary asset for clip {clip_id}: {e}")

    # 2. Clean up local video and thumbnail files on disk
    temp_dir = settings.TEMP_STORAGE_DIR
    local_candidates = []
    if clip_doc.get("videoUrl"):
        local_candidates.append(os.path.join(temp_dir, "public_media", "clips", os.path.basename(clip_doc["videoUrl"])))
    if clip_doc.get("thumbnailUrl"):
        local_candidates.append(os.path.join(temp_dir, "public_media", "thumbnails", os.path.basename(clip_doc["thumbnailUrl"])))
    local_candidates.append(os.path.join(temp_dir, "public_media", "clips", f"{clip_id}.mp4"))
    local_candidates.append(os.path.join(temp_dir, "public_media", "thumbnails", f"{clip_id}.jpg"))

    for fp in set(local_candidates):
        try:
            if os.path.isfile(fp):
                os.remove(fp)
                logger.info(f"Deleted local file for clip {clip_id}: {fp}")
        except Exception as e:
            logger.warning(f"Failed to delete local file {fp}: {e}")

    memory_store.delete_clip(clip_id)
    if db is not None:
        try:
            await db.clips.delete_one({"_id": clip_id})
        except Exception:
            pass

    # Record Audit
    memory_store.add_audit_log({
        "id": f"audit_{uuid.uuid4().hex[:12]}",
        "adminId": current_admin.id,
        "adminEmail": current_admin.email,
        "action": "CLIP_DELETED",
        "targetType": "CLIP",
        "targetId": clip_id,
        "metadata": {"title": clip_doc.get("title")},
        "createdAt": datetime.utcnow()
    })

    logger.info(f"Clip {clip_id} deleted by Admin {current_admin.email}")
    return {"message": "Clip deleted successfully.", "clipId": clip_id}
