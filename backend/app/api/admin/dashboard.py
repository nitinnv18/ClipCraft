from datetime import datetime
from typing import Dict, Any
from fastapi import APIRouter, Depends
from app.db.mongodb import get_database
from app.db.memory_store import memory_store
from app.models.admin import AdminResponse
from app.api.admin.auth import get_current_admin
from app.queue.redis_queue import queue_instance
from app.core.logging import logger
from app.core.utils import format_iso_utc

router = APIRouter(prefix="/dashboard", tags=["Admin Dashboard"])

@router.get("")
async def get_admin_dashboard_metrics(current_admin: AdminResponse = Depends(get_current_admin)) -> Dict[str, Any]:
    db = get_database()
    now = datetime.utcnow()
    today_start = datetime(now.year, now.month, now.day)

    # ── Attempt MongoDB aggregation (O(1) server-side) ────────────────────────
    if db is not None:
        try:
            # --- Users KPIs ---
            user_pipeline = [
                {"$group": {
                    "_id": None,
                    "total": {"$sum": 1},
                    "active": {"$sum": {"$cond": [{"$ne": ["$status", "suspended"]}, 1, 0]}}
                }}
            ]
            user_agg = await db.users.aggregate(user_pipeline).to_list(1)
            user_kpis = user_agg[0] if user_agg else {"total": 0, "active": 0}
            total_users = user_kpis.get("total", 0)
            active_users = user_kpis.get("active", 0)

            # --- Job KPIs ---
            job_pipeline = [
                {"$facet": {
                    "byStatus": [
                        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
                    ],
                    "today": [
                        {"$match": {"createdAt": {"$gte": today_start}}},
                        {"$count": "count"}
                    ],
                    "avgDuration": [
                        {"$match": {"status": "completed", "completedAt": {"$exists": True, "$ne": None}, "createdAt": {"$exists": True, "$ne": None}}},
                        {"$project": {
                            "turnaroundSec": {
                                "$divide": [{"$subtract": ["$completedAt", "$createdAt"]}, 1000]
                            }
                        }},
                        {"$match": {"turnaroundSec": {"$gt": 0, "$lte": 7200}}},
                        {"$group": {"_id": None, "avg": {"$avg": "$turnaroundSec"}}}
                    ]
                }}
            ]
            job_agg = await db.jobs.aggregate(job_pipeline).to_list(1)
            job_facet = job_agg[0] if job_agg else {}

            by_status: Dict[str, int] = {}
            for item in job_facet.get("byStatus", []):
                by_status[item["_id"]] = item["count"]

            total_jobs = sum(by_status.values())
            jobs_today = job_facet.get("today", [{}])[0].get("count", 0) if job_facet.get("today") else 0
            completed_jobs = by_status.get("completed", 0)
            failed_jobs = by_status.get("failed", 0) + by_status.get("error", 0)
            processing_jobs = sum(
                by_status.get(s, 0)
                for s in ["processing", "queued", "fetching", "transcribing", "analyzing", "rendering", "uploading"]
            )
            avg_agg = job_facet.get("avgDuration", [{}])
            avg_processing_time_sec = avg_agg[0].get("avg", 45.0) if avg_agg else 45.0

            # --- Clips KPI ---
            total_clips = await db.clips.count_documents({})

            # --- Recent Jobs (top 6 with user email lookup) ---
            recent_raw = await db.jobs.find(
                {},
                {"_id": 1, "userId": 1, "userEmail": 1, "title": 1, "status": 1, "stage": 1,
                 "progress": 1, "clipCount": 1, "createdAt": 1, "completedAt": 1, "error": 1}
            ).sort("createdAt", -1).limit(6).to_list(6)

            # Collect unique user IDs and batch-fetch emails
            user_ids = list({str(j.get("userId")) for j in recent_raw if j.get("userId")})
            user_cursor = db.users.find({"_id": {"$in": user_ids}}, {"_id": 1, "email": 1})
            user_email_map = {str(u["_id"]): u.get("email", "unknown") async for u in user_cursor}

            recent_jobs_clean = []
            for j in recent_raw:
                uid = str(j.get("userId", ""))
                st_val = j.get("status", "queued")
                st_clean = st_val.value if hasattr(st_val, "value") else str(st_val)
                stg_val = j.get("stage", "initializing")
                stg_clean = stg_val.value if hasattr(stg_val, "value") else str(stg_val)
                recent_jobs_clean.append({
                    "id": str(j.get("_id") or j.get("id")),
                    "userId": uid,
                    "userEmail": j.get("userEmail") or user_email_map.get(uid, "unknown"),
                    "title": j.get("title", "Untitled Job"),
                    "status": st_clean,
                    "stage": stg_clean,
                    "progress": j.get("progress", 0),
                    "clipCount": j.get("clipCount", 0),
                    "createdAt": format_iso_utc(j.get("createdAt")),
                    "completedAt": format_iso_utc(j.get("completedAt")),
                    "error": j.get("error")
                })

            # --- Recent Errors ---
            failed_raw = await db.jobs.find(
                {"status": {"$in": ["failed", "error"]}},
                {"_id": 1, "error": 1, "updatedAt": 1, "createdAt": 1}
            ).sort("updatedAt", -1).limit(5).to_list(5)

            recent_errors = [
                {
                    "id": str(fj.get("_id")),
                    "service": "Worker / FFmpeg",
                    "errorType": "JobProcessingError",
                    "message": fj.get("error") or "Processing terminated unexpectedly.",
                    "status": "CRITICAL",
                    "timestamp": format_iso_utc(fj.get("updatedAt") or fj.get("createdAt"))
                }
                for fj in failed_raw
            ]

        except Exception as e:
            logger.warning(f"Dashboard aggregation failed, falling back to memory store: {e}")
            db = None  # Fall through to memory store path below

    # ── Memory store fallback (DB unavailable) ────────────────────────────────
    if db is None:
        all_users = memory_store.get_all_users()
        all_jobs = memory_store.get_all_jobs()
        all_clips = memory_store.get_all_clips()

        total_users = len(all_users)
        active_users = len([u for u in all_users if u.get("status") != "suspended"])
        total_clips = len(all_clips)
        total_jobs = len(all_jobs)
        jobs_today = processing_jobs = completed_jobs = failed_jobs = 0
        total_processing_seconds = 0.0

        for j in all_jobs:
            created = j.get("createdAt")
            if isinstance(created, str):
                try:
                    created = datetime.fromisoformat(created.replace("Z", "+00:00")).replace(tzinfo=None)
                except Exception:
                    created = now
            if created and created >= today_start:
                jobs_today += 1
            s = j.get("status", "")
            if s in ["processing", "queued", "fetching", "transcribing", "analyzing", "rendering", "uploading"]:
                processing_jobs += 1
            elif s == "completed":
                completed_jobs += 1
                try:
                    total_processing_seconds += float(j.get("duration", 0))
                except Exception:
                    pass
            elif s in ["failed", "error"]:
                failed_jobs += 1

        avg_processing_time_sec = (total_processing_seconds / completed_jobs) if completed_jobs > 0 else 45.0

        recent_jobs_clean = []
        for j in sorted(all_jobs, key=lambda x: str(x.get("createdAt", "")), reverse=True)[:6]:
            uid = str(j.get("userId", ""))
            user_match = next((u for u in all_users if str(u.get("_id") or u.get("id")) == uid), None)
            st_val = j.get("status", "queued")
            st_clean = st_val.value if hasattr(st_val, "value") else str(st_val)
            stg_val = j.get("stage", "initializing")
            stg_clean = stg_val.value if hasattr(stg_val, "value") else str(stg_val)
            recent_jobs_clean.append({
                "id": str(j.get("id") or j.get("_id")),
                "userId": uid,
                "userEmail": j.get("userEmail") or (user_match.get("email") if user_match else "unknown"),
                "title": j.get("title", "Untitled Job"),
                "status": st_clean,
                "stage": stg_clean,
                "progress": j.get("progress", 0),
                "clipCount": j.get("clipCount", 0),
                "createdAt": format_iso_utc(j.get("createdAt")),
                "completedAt": format_iso_utc(j.get("completedAt")),
                "error": j.get("error")
            })

        recent_errors = [
            {
                "id": str(fj.get("id") or fj.get("_id")),
                "service": "Worker / FFmpeg",
                "errorType": "JobProcessingError",
                "message": fj.get("error") or "Processing terminated unexpectedly.",
                "status": "CRITICAL",
                "timestamp": format_iso_utc(fj.get("updatedAt") or fj.get("createdAt"))
            }
            for fj in [j for j in all_jobs if j.get("status") in ["failed", "error"]][:5]
        ]

    # ── Shared response assembly ───────────────────────────────────────────────
    total_storage_bytes = (total_clips * 12 * 1024 * 1024) + (total_jobs * 400 * 1024)
    storage_mb = round(total_storage_bytes / (1024 * 1024), 2)
    storage_gb = round(storage_mb / 1024, 2)

    is_redis = getattr(queue_instance, "is_connected", False)
    queue_metrics = {
        "depth": processing_jobs,
        "workersActive": 4 if processing_jobs > 0 else 1,
        "status": "operational",
        "redisConnected": is_redis
    }

    return {
        "kpis": {
            "totalUsers": total_users,
            "activeUsers": active_users,
            "totalJobs": total_jobs,
            "jobsToday": jobs_today,
            "processingJobs": processing_jobs,
            "completedJobs": completed_jobs,
            "failedJobs": failed_jobs,
            "totalClips": total_clips,
            "storageUsedFormatted": f"{storage_mb} MB" if storage_gb < 1 else f"{storage_gb} GB",
            "storageBytes": total_storage_bytes,
            "avgProcessingTimeSeconds": round(avg_processing_time_sec, 1)
        },
        "queue": queue_metrics,
        "recentJobs": recent_jobs_clean,
        "recentErrors": recent_errors,
        "systemStatus": "healthy" if failed_jobs == 0 or (total_jobs > 0 and (failed_jobs / total_jobs) < 0.2) else "degraded"
    }

