import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Query, status
from app.db.mongodb import get_database
from app.db.memory_store import memory_store
from app.models.admin import AdminResponse, AdminRole
from app.api.admin.auth import get_current_admin
from app.core.logging import logger

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
    all_clips = memory_store.get_all_clips()
    all_jobs = memory_store.get_all_jobs()
    all_users = memory_store.get_all_users()

    if db is not None:
        try:
            mongo_clips = await db.clips.find({}).to_list(10000)
            if mongo_clips:
                all_clips = mongo_clips
            mongo_jobs = await db.jobs.find({}).to_list(10000)
            if mongo_jobs:
                all_jobs = mongo_jobs
            mongo_users = await db.users.find({}).to_list(10000)
            if mongo_users:
                all_users = mongo_users
        except Exception:
            pass

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
            "createdAt": str(c.get("createdAt", ""))
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
    current_admin: AdminResponse = Depends(get_current_admin)
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
