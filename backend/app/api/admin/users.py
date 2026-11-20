import os
import shutil
import re
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

router = APIRouter(prefix="/users", tags=["Admin Users"])

@router.get("")
async def list_users(
    search: Optional[str] = Query(None, description="Search by email or user ID"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status (active/suspended)"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_admin: AdminResponse = Depends(get_current_admin)
) -> Dict[str, Any]:
    db = get_database()
    skip = (page - 1) * limit

    # ── MongoDB path: use DB-native pagination ────────────────────────────────
    if db is not None:
        try:
            query: Dict[str, Any] = {}
            if search:
                s = re.escape(search.strip())
                query["$or"] = [
                    {"email": {"$regex": s, "$options": "i"}},
                    {"_id": {"$regex": s, "$options": "i"}},
                ]
            if status_filter:
                query["status"] = status_filter.lower().strip()

            total = await db.users.count_documents(query)
            page_users = await db.users.find(query).sort("createdAt", -1).skip(skip).limit(limit).to_list(limit)

            # Fetch job/clip counts per user in one aggregation each
            user_ids = [str(u["_id"]) for u in page_users]
            job_counts = {
                item["_id"]: item["count"]
                async for item in db.jobs.aggregate([
                    {"$match": {"userId": {"$in": user_ids}}},
                    {"$group": {"_id": "$userId", "count": {"$sum": 1}}}
                ])
            }
            clip_counts = {
                item["_id"]: item["count"]
                async for item in db.clips.aggregate([
                    {"$match": {"userId": {"$in": user_ids}}},
                    {"$group": {"_id": "$userId", "count": {"$sum": 1}}}
                ])
            }

            user_rows = []
            for u in page_users:
                uid = str(u.get("_id") or u.get("id"))
                jc = job_counts.get(uid, 0)
                cc = clip_counts.get(uid, 0)
                user_rows.append({
                    "id": uid,
                    "email": u.get("email"),
                    "status": u.get("status") or "active",
                    "jobCount": jc,
                    "clipCount": cc,
                    "storageMb": round((cc * 12) + (jc * 0.4), 1),
                    "createdAt": format_iso_utc(u.get("createdAt")),
                    "lastActive": format_iso_utc(u.get("updatedAt") or u.get("createdAt"))
                })

            return {
                "users": user_rows,
                "total": total,
                "page": page,
                "limit": limit,
                "pages": (total + limit - 1) // limit
            }

        except Exception as e:
            logger.warning(f"DB user list query failed, using memory store: {e}")

    # ── Memory store fallback ─────────────────────────────────────────────────
    all_users = memory_store.get_all_users()
    all_jobs = memory_store.get_all_jobs()
    all_clips = memory_store.get_all_clips()

    filtered = all_users
    if search:
        s = search.lower().strip()
        filtered = [
            u for u in filtered
            if s in str(u.get("_id") or u.get("id")).lower()
            or s in u.get("email", "").lower()
        ]
    if status_filter:
        sf = status_filter.lower().strip()
        filtered = [u for u in filtered if (u.get("status") or "active").lower() == sf]

    filtered.sort(key=lambda x: str(x.get("createdAt", "")), reverse=True)
    total = len(filtered)
    page_users = filtered[skip: skip + limit]

    user_rows = []
    for u in page_users:
        uid = str(u.get("_id") or u.get("id"))
        user_jobs = [j for j in all_jobs if str(j.get("userId")) == uid]
        user_clips = [c for c in all_clips if str(c.get("userId")) == uid]
        user_rows.append({
            "id": uid,
            "email": u.get("email"),
            "status": u.get("status") or "active",
            "jobCount": len(user_jobs),
            "clipCount": len(user_clips),
            "storageMb": round((len(user_clips) * 12) + (len(user_jobs) * 0.4), 1),
            "createdAt": format_iso_utc(u.get("createdAt")),
            "lastActive": format_iso_utc(u.get("updatedAt") or u.get("createdAt"))
        })

    return {
        "users": user_rows,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit
    }


@router.get("/{user_id}")
async def get_user_detail(user_id: str, current_admin: AdminResponse = Depends(get_current_admin)) -> Dict[str, Any]:
    db = get_database()
    user_doc = None
    if db is not None:
        try:
            user_doc = await db.users.find_one({"_id": user_id})
        except Exception:
            pass

    if not user_doc:
        user_doc = memory_store.get_user_by_id(user_id)

    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found.")

    # Get User Jobs
    all_jobs = memory_store.get_all_jobs()
    all_clips = memory_store.get_all_clips()
    if db is not None:
        try:
            mongo_jobs = await db.jobs.find({"userId": user_id}).to_list(100)
            if mongo_jobs:
                all_jobs = mongo_jobs
            mongo_clips = await db.clips.find({"userId": user_id}).to_list(100)
            if mongo_clips:
                all_clips = mongo_clips
        except Exception:
            pass

    user_jobs = [j for j in all_jobs if str(j.get("userId")) == user_id]
    user_clips = [c for c in all_clips if str(c.get("userId")) == user_id]

    completed_jobs = len([j for j in user_jobs if j.get("status") == "completed"])
    failed_jobs = len([j for j in user_jobs if j.get("status") in ["failed", "error"]])
    storage_mb = round((len(user_clips) * 12) + (len(user_jobs) * 0.4), 1)

    return {
        "user": {
            "id": user_id,
            "email": user_doc.get("email"),
            "status": user_doc.get("status") or "active",
            "createdAt": format_iso_utc(user_doc.get("createdAt")),
            "updatedAt": format_iso_utc(user_doc.get("updatedAt")),
            "suspensionReason": user_doc.get("suspensionReason"),
            "suspendedAt": format_iso_utc(user_doc.get("suspendedAt")),
            "suspendedBy": user_doc.get("suspendedBy")
        },
        "usage": {
            "totalJobs": len(user_jobs),
            "completedJobs": completed_jobs,
            "failedJobs": failed_jobs,
            "totalClips": len(user_clips),
            "storageMb": storage_mb
        },
        "recentJobs": [
            {
                "id": j.get("id") or j.get("_id"),
                "title": j.get("title", "Untitled"),
                "status": j.get("status", "queued"),
                "clipCount": j.get("clipCount", 0),
                "createdAt": format_iso_utc(j.get("createdAt"))
            }
            for j in user_jobs[:10]
        ],
        "recentClips": [
            {
                "id": c.get("id") or c.get("_id"),
                "title": c.get("title", "Untitled Clip"),
                "duration": c.get("duration", 0),
                "score": c.get("score", 90),
                "createdAt": format_iso_utc(c.get("createdAt"))
            }
            for c in user_clips[:10]
        ]
    }

@router.post("/{user_id}/suspend")
async def suspend_user(
    user_id: str,
    reason: Optional[str] = None,
    current_admin: AdminResponse = Depends(require_roles([AdminRole.SUPER_ADMIN, AdminRole.ADMIN]))
):
    db = get_database()
    now = datetime.utcnow()
    suspension_data = {
        "status": "suspended",
        "suspensionReason": reason or "Administrative suspension by policy.",
        "suspendedAt": now,
        "suspendedBy": current_admin.email
    }

    memory_store.update_user(user_id, suspension_data)
    if db is not None:
        try:
            await db.users.update_one({"_id": user_id}, {"$set": suspension_data})
        except Exception:
            pass

    # Record Audit
    memory_store.add_audit_log({
        "id": f"audit_{uuid.uuid4().hex[:12]}",
        "adminId": current_admin.id,
        "adminEmail": current_admin.email,
        "action": "USER_SUSPENDED",
        "targetType": "USER",
        "targetId": user_id,
        "metadata": {"reason": reason},
        "createdAt": now
    })

    logger.info(f"User suspended by {current_admin.email}: {user_id}")
    return {"message": "User has been suspended.", "userId": user_id, "status": "suspended"}

@router.post("/{user_id}/unsuspend")
async def unsuspend_user(
    user_id: str,
    current_admin: AdminResponse = Depends(require_roles([AdminRole.SUPER_ADMIN, AdminRole.ADMIN]))
):
    db = get_database()
    now = datetime.utcnow()
    unsuspend_data = {
        "status": "active",
        "suspensionReason": None,
        "suspendedAt": None,
        "suspendedBy": None
    }

    memory_store.update_user(user_id, unsuspend_data)
    if db is not None:
        try:
            await db.users.update_one({"_id": user_id}, {"$set": unsuspend_data})
        except Exception:
            pass

    # Record Audit
    memory_store.add_audit_log({
        "id": f"audit_{uuid.uuid4().hex[:12]}",
        "adminId": current_admin.id,
        "adminEmail": current_admin.email,
        "action": "USER_UNSUSPENDED",
        "targetType": "USER",
        "targetId": user_id,
        "metadata": {},
        "createdAt": now
    })

    logger.info(f"User unsuspended by {current_admin.email}: {user_id}")
    return {"message": "User account restored to active.", "userId": user_id, "status": "active"}

@router.delete("/{user_id}")
async def delete_user(
    user_id: str,
    current_admin: AdminResponse = Depends(require_roles([AdminRole.SUPER_ADMIN]))
):
    db = get_database()
    temp_dir = settings.TEMP_STORAGE_DIR

    # 1. Gather all clips for this user
    user_clips = [c for c in memory_store.get_all_clips() if str(c.get("userId")) == user_id]
    if db is not None:
        try:
            db_clips = await db.clips.find({"userId": user_id}).to_list(10000)
            user_clips.extend(db_clips)
        except Exception:
            pass

    # Clean up Cloudinary assets & local files for each clip
    seen_clip_ids = set()
    for c in user_clips:
        cid = str(c.get("id") or c.get("_id"))
        if cid in seen_clip_ids:
            continue
        seen_clip_ids.add(cid)

        pub_id = c.get("cloudinaryPublicId")
        if pub_id:
            try:
                await cloudinary_provider.delete_file(pub_id)
            except Exception as e:
                logger.warning(f"Failed to delete Cloudinary asset for clip {cid}: {e}")

        candidates = [
            os.path.join(temp_dir, "public_media", "clips", f"{cid}.mp4"),
            os.path.join(temp_dir, "public_media", "thumbnails", f"{cid}.jpg"),
        ]
        if c.get("videoUrl"):
            candidates.append(os.path.join(temp_dir, "public_media", "clips", os.path.basename(c["videoUrl"])))
        if c.get("thumbnailUrl"):
            candidates.append(os.path.join(temp_dir, "public_media", "thumbnails", os.path.basename(c["thumbnailUrl"])))
        for fp in set(candidates):
            try:
                if os.path.isfile(fp):
                    os.remove(fp)
            except Exception:
                pass
        memory_store.delete_clip(cid)

    # 2. Gather all jobs for this user
    user_jobs = [j for j in memory_store.get_all_jobs() if str(j.get("userId")) == user_id]
    if db is not None:
        try:
            db_jobs = await db.jobs.find({"userId": user_id}).to_list(10000)
            user_jobs.extend(db_jobs)
        except Exception:
            pass

    seen_job_ids = set()
    for j in user_jobs:
        jid = str(j.get("id") or j.get("_id"))
        if jid in seen_job_ids:
            continue
        seen_job_ids.add(jid)

        if j.get("thumbnail"):
            thumb_path = os.path.join(temp_dir, "public_media", "thumbnails", os.path.basename(j["thumbnail"]))
            if os.path.isfile(thumb_path):
                try:
                    os.remove(thumb_path)
                except Exception:
                    pass
        job_dir = os.path.join(temp_dir, jid)
        if os.path.isdir(job_dir):
            try:
                shutil.rmtree(job_dir, ignore_errors=True)
            except Exception:
                pass

    memory_store.delete_user(user_id)
    if db is not None:
        try:
            await db.users.delete_one({"_id": user_id})
            await db.jobs.delete_many({"userId": user_id})
            await db.clips.delete_many({"userId": user_id})
        except Exception:
            pass

    # Record Audit
    memory_store.add_audit_log({
        "id": f"audit_{uuid.uuid4().hex[:12]}",
        "adminId": current_admin.id,
        "adminEmail": current_admin.email,
        "action": "USER_DELETED",
        "targetType": "USER",
        "targetId": user_id,
        "metadata": {},
        "createdAt": datetime.utcnow()
    })

    logger.warning(f"User {user_id} deleted permanently by Super Admin: {current_admin.email}")
    return {"message": "User and associated records deleted permanently.", "userId": user_id}
