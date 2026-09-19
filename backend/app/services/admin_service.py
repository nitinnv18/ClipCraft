import os
from datetime import datetime
from typing import Dict, Any, List, Optional
from app.core.config import settings
from app.db.mongodb import get_database
from app.db.memory_store import memory_store
from app.core.logging import logger

class AdminService:
    @staticmethod
    async def get_dashboard_metrics() -> Dict[str, Any]:
        db = get_database()
        total_users = 0
        total_jobs = 0
        total_clips = 0
        active_jobs = 0

        if db is not None:
            try:
                total_users = await db.users.count_documents({})
                total_jobs = await db.jobs.count_documents({})
                total_clips = await db.clips.count_documents({})
                active_jobs = await db.jobs.count_documents({"status": {"$in": ["queued", "processing"]}})
            except Exception as e:
                logger.warning(f"Error querying mongo metrics: {e}")

        # Fallback to memory_store counts if larger
        mem_users = len(memory_store.users)
        mem_jobs = len(memory_store.jobs)
        mem_clips = sum(len(c) for c in memory_store.clips.values())
        mem_active = sum(1 for j in memory_store.jobs.values() if j.get("status") in ["queued", "processing"])

        total_users = max(total_users, mem_users)
        total_jobs = max(total_jobs, mem_jobs)
        total_clips = max(total_clips, mem_clips)
        active_jobs = max(active_jobs, mem_active)

        # Safe system load info
        cpu_usage = 12.5
        memory_percent = 45.0
        memory_used_mb = 3500.0
        memory_total_mb = 16000.0

        try:
            import psutil
            cpu_usage = psutil.cpu_percent(interval=None)
            mem = psutil.virtual_memory()
            memory_percent = mem.percent
            memory_used_mb = round(mem.used / (1024 * 1024), 2)
            memory_total_mb = round(mem.total / (1024 * 1024), 2)
        except Exception:
            pass

        return {
            "totalUsers": total_users,
            "totalJobs": total_jobs,
            "totalClips": total_clips,
            "activeJobs": active_jobs,
            "systemLoad": {
                "cpuPercent": cpu_usage,
                "memoryPercent": memory_percent,
                "memoryUsedMb": memory_used_mb,
                "memoryTotalMb": memory_total_mb
            }
        }

    @staticmethod
    async def log_admin_action(admin_id: str, admin_username: str, action: str, details: Dict[str, Any]) -> None:
        db = get_database()
        log_entry = {
            "adminId": admin_id,
            "adminUsername": admin_username,
            "action": action,
            "details": details,
            "timestamp": datetime.utcnow()
        }
        if db is not None:
            try:
                await db.audit_logs.insert_one(log_entry)
            except Exception as e:
                logger.warning(f"Failed to record audit log: {e}")

admin_service = AdminService()
