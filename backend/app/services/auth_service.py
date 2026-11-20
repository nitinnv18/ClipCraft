import uuid
from datetime import datetime
from typing import Optional, Tuple
from app.db.mongodb import get_database
from app.db.memory_store import memory_store
from app.core.security import create_access_token, get_password_hash_async, verify_password_async
from app.core.utils import utc_now
from app.core.logging import logger
from app.models.user import UserResponse

class AuthService:
    @staticmethod
    async def get_user_by_id(user_id: str) -> Optional[UserResponse]:
        db = get_database()

        # 1. MongoDB check
        if db is not None:
            try:
                user_doc = await db.users.find_one({"_id": user_id})
                if user_doc:
                    created_at = user_doc.get("createdAt")
                    if isinstance(created_at, str):
                        created_at = datetime.fromisoformat(created_at)
                    return UserResponse(
                        id=user_doc["_id"],
                        email=user_doc["email"],
                        status=user_doc.get("status", "active"),
                        createdAt=created_at or datetime.utcnow()
                    )
            except Exception as e:
                logger.warning(f"Error querying mongo user: {e}")

        # 2. MemoryStore check
        mem_user = memory_store.get_user_by_id(user_id)
        if mem_user:
            created_at = mem_user.get("createdAt")
            if isinstance(created_at, str):
                created_at = datetime.fromisoformat(created_at)
            return UserResponse(
                id=mem_user["_id"],
                email=mem_user["email"],
                status=mem_user.get("status", "active"),
                createdAt=created_at or datetime.utcnow()
            )

        return None

    @staticmethod
    async def register_user(email: str, password: str) -> Tuple[str, UserResponse, bool]:
        """Returns (access_token, UserResponse, was_existing_login)"""
        clean_email = email.lower().strip()
        db = get_database()
        existing_user = None

        if db is not None:
            try:
                existing_user = await db.users.find_one({"email": clean_email})
            except Exception as e:
                logger.debug(f"DB lookup existing user notice: {e}")

        if not existing_user:
            existing_user = memory_store.get_user_by_email(clean_email)

        if existing_user:
            raise ValueError("An account with this email already exists. Please sign in.")

        user_id = f"user_{uuid.uuid4().hex[:12]}"
        password_hash = await get_password_hash_async(password)
        now = utc_now()

        user_doc = {
            "_id": user_id,
            "email": clean_email,
            "passwordHash": password_hash,
            "createdAt": now,
            "updatedAt": now
        }

        memory_store.set_user(user_id, user_doc)
        if db is not None:
            try:
                await db.users.insert_one(user_doc)
            except Exception as e:
                logger.warning(f"Failed to persist user to MongoDB: {e}")

        token = create_access_token(subject=user_id, email=clean_email)
        user_res = UserResponse(id=user_id, email=clean_email, createdAt=now)
        return token, user_res, False

    @staticmethod
    async def authenticate_user(email: str, password: str) -> Optional[Tuple[str, UserResponse]]:
        clean_email = email.lower().strip()

        # Check account lockout status
        lockout_secs = memory_store.get_lockout_remaining_seconds(clean_email)
        if lockout_secs:
            mins = max(1, lockout_secs // 60)
            raise ValueError(f"Too many failed login attempts. Account temporarily locked for {mins} minute(s).")

        db = get_database()
        user_doc = None

        if db is not None:
            try:
                user_doc = await db.users.find_one({"email": clean_email})
            except Exception:
                pass

        if not user_doc:
            user_doc = memory_store.get_user_by_email(clean_email)

        if not user_doc or not await verify_password_async(password, user_doc.get("passwordHash", "")):
            memory_store.record_failed_login(clean_email)
            return None

        # Disallow suspended accounts from acquiring active session tokens
        if user_doc.get("status") == "suspended":
            raise ValueError("This account has been suspended. Please contact ClipCraft support.")

        # Reset failed login count on successful authentication
        memory_store.reset_failed_logins(clean_email)

        token = create_access_token(subject=user_doc["_id"], email=clean_email)
        created_at = user_doc.get("createdAt")
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at)
        user_res = UserResponse(id=user_doc["_id"], email=user_doc["email"], createdAt=created_at or datetime.utcnow())
        return token, user_res

auth_service = AuthService()
