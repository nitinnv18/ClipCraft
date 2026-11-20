from collections import deque
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional

class MemoryStore:
    def __init__(self):
        self.jobs: Dict[str, Dict[str, Any]] = {}
        self.clips: Dict[str, Dict[str, Any]] = {}
        self.users: Dict[str, Dict[str, Any]] = {}
        self.admins: Dict[str, Dict[str, Any]] = {}
        self.audit_logs: deque = deque(maxlen=1000)
        self.system_logs: deque = deque(maxlen=500)
        self.system_settings: Dict[str, Any] = {
            "projectName": "ClipCraft",
            "maintenanceMode": False,
            "maintenanceMessage": "ClipCraft is temporarily undergoing scheduled maintenance. Please check back shortly.",
            "supportEmail": "support@clipcraft.io",
            "freeTierDailyLimit": 5,
            "maxClipsPerJob": 10,
            "maxVideoDurationSeconds": 7200,
            "allowAnonymousPreviews": True,
            "maxConcurrentWorkers": 4,
            "jobTimeoutSeconds": 900,
            "maxRetryAttempts": 3,
            "overlapDeduplicationThreshold": 25,
            "sentenceSnapBoundarySeconds": 3.0,
            "retentionDays": 30,
            "autoCleanupOrphanedMedia": True,
            "maxUserStorageBytes": 10737418240,
            "sessionTimeoutMinutes": 1440,
            "requireAdmin2FA": False,
            "maxLoginAttempts": 5,
            "lockoutDurationMinutes": 15,
            "updatedBy": "system",
            "updatedAt": datetime.utcnow()
        }
        self.failed_login_attempts: Dict[str, Dict[str, Any]] = {}

    # --- Users ---
    def get_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        return self.users.get(user_id)

    def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        clean_email = email.lower().strip()
        for u in self.users.values():
            if u.get("email", "").lower().strip() == clean_email:
                return u
        return None

    def set_user(self, user_id: str, data: Dict[str, Any]):
        self.users[user_id] = data

    def get_all_users(self) -> List[Dict[str, Any]]:
        return list(self.users.values())

    def update_user(self, user_id: str, updates: Dict[str, Any]):
        if user_id in self.users:
            self.users[user_id].update(updates)
            self.users[user_id]["updatedAt"] = datetime.utcnow()

    def delete_user(self, user_id: str):
        if user_id in self.users:
            del self.users[user_id]
        # Delete user jobs & clips safely using snapshot
        user_jobs = [jid for jid, j in list(self.jobs.items()) if j.get("userId") == user_id]
        for jid in user_jobs:
            self.delete_job(jid)
        user_clips = [cid for cid, c in list(self.clips.items()) if c.get("userId") == user_id]
        for cid in user_clips:
            self.delete_clip(cid)

    # --- Admins ---
    def get_admin_by_id(self, admin_id: str) -> Optional[Dict[str, Any]]:
        return self.admins.get(admin_id)

    def get_admin_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        clean_email = email.lower().strip()
        for a in self.admins.values():
            if a.get("email", "").lower().strip() == clean_email:
                return a
        return None

    def set_admin(self, admin_id: str, data: Dict[str, Any]):
        self.admins[admin_id] = data

    def get_all_admins(self) -> List[Dict[str, Any]]:
        return list(self.admins.values())

    def update_admin(self, admin_id: str, updates: Dict[str, Any]):
        if admin_id in self.admins:
            self.admins[admin_id].update(updates)
            self.admins[admin_id]["updatedAt"] = datetime.utcnow()

    def delete_admin(self, admin_id: str):
        if admin_id in self.admins:
            del self.admins[admin_id]

    # --- Jobs ---
    def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        return self.jobs.get(job_id)

    def set_job(self, job_id: str, data: Dict[str, Any]):
        self.jobs[job_id] = data

    def get_all_jobs(self) -> List[Dict[str, Any]]:
        return list(self.jobs.values())

    def update_job(self, job_id: str, updates: Dict[str, Any]):
        if job_id in self.jobs:
            self.jobs[job_id].update(updates)
            self.jobs[job_id]["updatedAt"] = datetime.utcnow()

    def delete_job(self, job_id: str):
        if job_id in self.jobs:
            del self.jobs[job_id]
        clips_to_del = [cid for cid, c in list(self.clips.items()) if c.get("jobId") == job_id]
        for cid in clips_to_del:
            del self.clips[cid]

    # --- Clips ---
    def add_clip(self, clip_id: str, clip_data: Dict[str, Any]):
        self.clips[clip_id] = clip_data

    def get_clip(self, clip_id: str) -> Optional[Dict[str, Any]]:
        return self.clips.get(clip_id)

    def get_job_clips(self, job_id: str) -> List[Dict[str, Any]]:
        return [c for c in self.clips.values() if c.get("jobId") == job_id]

    def get_all_clips(self) -> List[Dict[str, Any]]:
        return list(self.clips.values())

    def delete_clip(self, clip_id: str):
        if clip_id in self.clips:
            del self.clips[clip_id]

    # --- Audit Logs ---
    def add_audit_log(self, log_entry: Dict[str, Any]):
        self.audit_logs.appendleft(log_entry)
        try:
            from app.db.mongodb import get_database
            import asyncio
            db = get_database()
            if db is not None:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    loop.create_task(db.audit_logs.insert_one(dict(log_entry)))
        except Exception:
            pass

    def get_audit_logs(self, limit: int = 100) -> List[Dict[str, Any]]:
        return list(self.audit_logs)[:limit]

    # --- System Logs ---
    def add_system_log(self, level: str, service: str, message: str, metadata: Dict[str, Any] = None):
        entry = {
            "id": f"log_{len(self.system_logs) + 1}",
            "level": level,
            "service": service,
            "message": message,
            "metadata": metadata or {},
            "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
        }
        self.system_logs.appendleft(entry)

    def get_system_logs(self, level: Optional[str] = None, service: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
        results = list(self.system_logs)
        if level:
            results = [l for l in results if l.get("level", "").upper() == level.upper()]
        if service:
            results = [l for l in results if l.get("service", "").lower() == service.lower()]
        return results[:limit]

    # --- System Settings ---
    def get_settings(self) -> Dict[str, Any]:
        return self.system_settings

    def update_settings(self, updates: Dict[str, Any], updated_by: str = "admin"):
        self.system_settings.update(updates)
        self.system_settings["updatedBy"] = updated_by
        self.system_settings["updatedAt"] = datetime.utcnow()

    # --- Brute Force & Account Lockout ---
    def get_lockout_remaining_seconds(self, email: str) -> Optional[int]:
        clean_email = email.lower().strip()
        record = self.failed_login_attempts.get(clean_email)
        if not record or not record.get("lockedUntil"):
            return None
        now = datetime.utcnow()
        locked_until: datetime = record["lockedUntil"]
        if now < locked_until:
            return max(1, int((locked_until - now).total_seconds()))
        # Lockout expired
        self.failed_login_attempts.pop(clean_email, None)
        return None

    def record_failed_login(self, email: str) -> int:
        clean_email = email.lower().strip()
        max_attempts = self.system_settings.get("maxLoginAttempts", 5)
        lockout_minutes = self.system_settings.get("lockoutDurationMinutes", 15)

        now = datetime.utcnow()
        record = self.failed_login_attempts.get(clean_email, {"count": 0, "lockedUntil": None})
        record["count"] += 1

        if record["count"] >= max_attempts:
            record["lockedUntil"] = now + timedelta(minutes=lockout_minutes)

        self.failed_login_attempts[clean_email] = record
        return record["count"]

    def reset_failed_logins(self, email: str):
        clean_email = email.lower().strip()
        self.failed_login_attempts.pop(clean_email, None)

memory_store = MemoryStore()
