import uuid
from datetime import datetime, timedelta
from typing import List
from fastapi import APIRouter, HTTPException, Depends, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.config import settings
from app.core.security import get_password_hash, verify_password, create_access_token, decode_access_token
from app.db.mongodb import get_database
from app.db.memory_store import memory_store
from app.models.admin import (
    AdminLogin,
    AdminRole,
    AdminStatus,
    AdminResponse,
    AdminTokenResponse,
)
from app.core.logging import logger
from app.middleware.rate_limit import limiter, ADMIN_AUTH_LIMIT

router = APIRouter(prefix="/auth", tags=["Admin Auth"])
security = HTTPBearer(auto_error=False)

async def seed_default_super_admin():
    """Ensure a default Super Admin exists in the database and memory store based on environment variables."""
    if not settings.SUPER_ADMIN_PASSWORD:
        return

    admin_email = settings.SUPER_ADMIN_EMAIL.lower().strip()
    admin_password = settings.SUPER_ADMIN_PASSWORD
    admin_id = "admin_super_root"
    now = datetime.utcnow()
    pw_hash = get_password_hash(admin_password)

    admin_doc = {
        "_id": admin_id,
        "id": admin_id,
        "email": admin_email,
        "name": "Super Administrator",
        "passwordHash": pw_hash,
        "role": AdminRole.SUPER_ADMIN.value,
        "status": AdminStatus.ACTIVE.value,
        "lastLoginAt": None,
        "createdAt": now,
        "updatedAt": now
    }
    memory_store.set_admin(admin_id, admin_doc)

    db = get_database()
    if db is not None:
        try:
            await db.admins.update_one(
                {"$or": [{"_id": admin_id}, {"email": admin_email}]},
                {
                    "$set": {
                        "email": admin_email,
                        "passwordHash": pw_hash,
                        "role": AdminRole.SUPER_ADMIN.value,
                        "status": AdminStatus.ACTIVE.value,
                        "updatedAt": now
                    },
                    "$setOnInsert": {
                        "_id": admin_id,
                        "id": admin_id,
                        "name": "Super Administrator",
                        "createdAt": now,
                        "lastLoginAt": None
                    }
                },
                upsert=True
            )
            logger.info(f"Synchronized default Super Admin: {admin_email}")
        except Exception as e:
            logger.warning(f"DB sync for super admin failed: {e}")

async def get_current_admin(credentials: HTTPAuthorizationCredentials = Depends(security)) -> AdminResponse:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin authentication token required.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload or "sub" not in payload or payload.get("type") != "admin":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired administrative token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    admin_id = payload["sub"]
    db = get_database()
    admin_doc = None

    if db is not None:
        try:
            admin_doc = await db.admins.find_one({"_id": admin_id})
        except Exception:
            pass

    if not admin_doc:
        admin_doc = memory_store.get_admin_by_id(admin_id)

    # Fallback to default super admin if matching ID
    if not admin_doc and admin_id == "admin_super_root":
        admin_doc = memory_store.get_admin_by_email(settings.SUPER_ADMIN_EMAIL)

    if not admin_doc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Admin account not found.")

    if admin_doc.get("status") == AdminStatus.SUSPENDED.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin account has been suspended.")

    created_at = admin_doc.get("createdAt")
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at)
    updated_at = admin_doc.get("updatedAt")
    if isinstance(updated_at, str):
        updated_at = datetime.fromisoformat(updated_at)
    last_login = admin_doc.get("lastLoginAt")
    if isinstance(last_login, str):
        last_login = datetime.fromisoformat(last_login)

    return AdminResponse(
        id=admin_doc.get("id") or admin_doc.get("_id"),
        email=admin_doc["email"],
        name=admin_doc.get("name"),
        role=AdminRole(admin_doc.get("role", "ADMIN")),
        status=AdminStatus(admin_doc.get("status", "ACTIVE")),
        lastLoginAt=last_login,
        createdAt=created_at or datetime.utcnow(),
        updatedAt=updated_at or datetime.utcnow()
    )

def require_roles(allowed_roles: List[AdminRole]):
    async def role_checker(current_admin: AdminResponse = Depends(get_current_admin)) -> AdminResponse:
        if current_admin.role not in allowed_roles and current_admin.role != AdminRole.SUPER_ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operation requires one of the following roles: {[r.value for r in allowed_roles]}"
            )
        return current_admin
    return role_checker

@router.post("/login", response_model=AdminTokenResponse)
@limiter.limit(ADMIN_AUTH_LIMIT)
async def admin_login(req: AdminLogin, request: Request):
    await seed_default_super_admin()
    email = req.email.lower().strip()
    db = get_database()
    admin_doc = None

    if db is not None:
        try:
            admin_doc = await db.admins.find_one({"email": email})
        except Exception:
            pass

    if not admin_doc:
        admin_doc = memory_store.get_admin_by_email(email)

    if not admin_doc or not verify_password(req.password, admin_doc.get("passwordHash", "")):
        raise HTTPException(status_code=401, detail="Invalid administrator email or password.")

    if admin_doc.get("status") == AdminStatus.SUSPENDED.value:
        raise HTTPException(status_code=403, detail="This administrator account has been deactivated.")

    # Update last login timestamp
    now = datetime.utcnow()
    admin_id = admin_doc.get("id") or admin_doc.get("_id")
    memory_store.update_admin(admin_id, {"lastLoginAt": now})
    if db is not None:
        try:
            await db.admins.update_one({"_id": admin_id}, {"$set": {"lastLoginAt": now}})
        except Exception as e:
            logger.warning(f"Failed to update admin last-login timestamp: {e}")

    # Encode token with admin-type claims in a single pass
    encoded_token = create_access_token(
        subject=admin_id,
        email=email,
        expires_delta=timedelta(minutes=settings.ADMIN_TOKEN_EXPIRE_MINUTES),
        extra_claims={
            "type": "admin",
            "role": admin_doc.get("role", "ADMIN"),
        },
    )

    # Record Audit Log
    memory_store.add_audit_log({
        "id": f"audit_{uuid.uuid4().hex[:12]}",
        "adminId": admin_id,
        "adminEmail": email,
        "action": "ADMIN_LOGIN",
        "targetType": "AUTH",
        "targetId": admin_id,
        "metadata": {"ip": request.client.host if request.client else "unknown"},
        "createdAt": now
    })

    created_at = admin_doc.get("createdAt")
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at)
    updated_at = admin_doc.get("updatedAt")
    if isinstance(updated_at, str):
        updated_at = datetime.fromisoformat(updated_at)

    admin_res = AdminResponse(
        id=admin_id,
        email=email,
        name=admin_doc.get("name"),
        role=AdminRole(admin_doc.get("role", "ADMIN")),
        status=AdminStatus(admin_doc.get("status", "ACTIVE")),
        lastLoginAt=now,
        createdAt=created_at or now,
        updatedAt=updated_at or now
    )

    logger.info(f"Admin signed in: {email} ({admin_res.role})")
    return AdminTokenResponse(access_token=encoded_token, admin=admin_res)

@router.get("/me", response_model=AdminResponse)
async def get_admin_profile(current_admin: AdminResponse = Depends(get_current_admin)):
    return current_admin

@router.post("/logout")
async def admin_logout(current_admin: AdminResponse = Depends(get_current_admin)):
    return {"message": "Admin session terminated successfully."}
