import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, Depends, status
from pymongo.errors import DuplicateKeyError

from app.db.mongodb import get_database
from app.db.memory_store import memory_store
from app.models.admin import AdminResponse, AdminRole, AdminCreate, AdminUpdate, AdminStatus
from app.models.system_setting import SystemSettingsUpdate
from app.api.admin.auth import get_current_admin, require_roles
from app.core.security import get_password_hash_async
from app.core.utils import utc_now
from app.core.logging import logger

def _parse_datetime(val: Any, default: Optional[datetime] = None) -> Optional[datetime]:
    if isinstance(val, datetime):
        return val
    if isinstance(val, str):
        try:
            return datetime.fromisoformat(val)
        except Exception:
            return default
    return default

router = APIRouter(prefix="/settings", tags=["Admin Settings"])

# --- System Settings ---
@router.get("", response_model=Dict[str, Any])
async def get_system_settings(current_admin: AdminResponse = Depends(get_current_admin)):
    db = get_database()
    settings_data = memory_store.get_settings()
    if db is not None:
        try:
            mongo_settings = await db.system_settings.find_one({"_id": "global_config"})
            if mongo_settings:
                settings_data = mongo_settings
        except Exception as e:
            logger.warning(f"Error fetching system settings from DB: {e}")
    return settings_data

@router.patch("", response_model=Dict[str, Any])
async def update_system_settings(
    req: SystemSettingsUpdate,
    current_admin: AdminResponse = Depends(require_roles([AdminRole.SUPER_ADMIN]))
):
    db = get_database()
    updates = req.model_dump(exclude_unset=True)
    if not updates:
        return memory_store.get_settings()

    now = utc_now()
    updates["updatedBy"] = current_admin.email
    updates["updatedAt"] = now

    # Persist to database first to maintain single source of truth
    if db is not None:
        try:
            await db.system_settings.update_one(
                {"_id": "global_config"},
                {"$set": updates},
                upsert=True
            )
        except Exception as e:
            logger.error(f"Failed to persist system settings in MongoDB: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database update failed: {str(e)}"
            )

    memory_store.update_settings(updates, updated_by=current_admin.email)

    # Record Audit Log
    memory_store.add_audit_log({
        "id": f"audit_{uuid.uuid4().hex[:12]}",
        "adminId": current_admin.id,
        "adminEmail": current_admin.email,
        "action": "SETTINGS_UPDATED",
        "targetType": "SETTINGS",
        "targetId": "global_config",
        "metadata": updates,
        "createdAt": now
    })

    logger.info(f"System settings updated by Super Admin {current_admin.email}")
    return memory_store.get_settings()

# --- Administrator Account Management ---
@router.get("/admins", response_model=List[AdminResponse])
async def list_admins(current_admin: AdminResponse = Depends(require_roles([AdminRole.SUPER_ADMIN]))):
    db = get_database()
    all_admins = memory_store.get_all_admins()
    if db is not None:
        try:
            mongo_admins = await db.admins.find({}).to_list(200)
            if mongo_admins:
                all_admins = mongo_admins
        except Exception as e:
            logger.warning(f"Error listing admins from DB: {e}")

    now = utc_now()
    results = []
    for a in all_admins:
        created_at = _parse_datetime(a.get("createdAt"), default=now)
        updated_at = _parse_datetime(a.get("updatedAt"), default=now)
        last_login = _parse_datetime(a.get("lastLoginAt"), default=None)

        results.append(
            AdminResponse(
                id=str(a.get("id") or a.get("_id")),
                email=a.get("email"),
                name=a.get("name"),
                role=AdminRole(a.get("role", "ADMIN")),
                status=AdminStatus(a.get("status", "ACTIVE")),
                lastLoginAt=last_login,
                createdAt=created_at or now,
                updatedAt=updated_at or now
            )
        )
    return results

@router.post("/admins", response_model=AdminResponse, status_code=status.HTTP_201_CREATED)
async def create_admin(
    req: AdminCreate,
    current_admin: AdminResponse = Depends(require_roles([AdminRole.SUPER_ADMIN]))
):
    email = req.email.lower().strip()
    db = get_database()
    
    if memory_store.get_admin_by_email(email):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Admin account with this email already exists.")

    if db is not None:
        try:
            existing = await db.admins.find_one({"email": email})
            if existing:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Admin account with this email already exists.")
        except HTTPException:
            raise
        except Exception as e:
            logger.warning(f"DB existing admin lookup check: {e}")

    admin_id = f"admin_{uuid.uuid4().hex[:12]}"
    now = utc_now()
    hashed_pw = await get_password_hash_async(req.password)
    admin_doc = {
        "_id": admin_id,
        "id": admin_id,
        "email": email,
        "name": req.name or email.split("@")[0],
        "passwordHash": hashed_pw,
        "role": req.role.value if hasattr(req.role, "value") else str(req.role),
        "status": AdminStatus.ACTIVE.value,
        "lastLoginAt": None,
        "createdAt": now,
        "updatedAt": now
    }

    if db is not None:
        try:
            await db.admins.insert_one(admin_doc)
        except DuplicateKeyError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Admin account with this email already exists."
            )
        except Exception as e:
            logger.error(f"Failed to persist admin to MongoDB: {e}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to create admin in database: {str(e)}")

    # Update in-memory store only after successful DB persistence
    memory_store.set_admin(admin_id, admin_doc)

    # Record Audit
    memory_store.add_audit_log({
        "id": f"audit_{uuid.uuid4().hex[:12]}",
        "adminId": current_admin.id,
        "adminEmail": current_admin.email,
        "action": "ADMIN_CREATED",
        "targetType": "ADMIN",
        "targetId": admin_id,
        "metadata": {"email": email, "role": admin_doc["role"]},
        "createdAt": now
    })

    logger.info(f"New admin created by {current_admin.email}: {email} ({admin_doc['role']})")
    return AdminResponse(
        id=admin_id,
        email=email,
        name=admin_doc["name"],
        role=req.role,
        status=AdminStatus.ACTIVE,
        lastLoginAt=None,
        createdAt=now,
        updatedAt=now
    )

@router.patch("/admins/{admin_id}", response_model=AdminResponse)
async def update_admin_role_or_status(
    admin_id: str,
    req: AdminUpdate,
    current_admin: AdminResponse = Depends(require_roles([AdminRole.SUPER_ADMIN]))
):
    db = get_database()
    admin_doc = memory_store.get_admin_by_id(admin_id)
    if not admin_doc and db is not None:
        try:
            admin_doc = await db.admins.find_one({"_id": admin_id})
            if admin_doc:
                memory_store.set_admin(admin_id, dict(admin_doc))
        except Exception as e:
            logger.warning(f"Error finding admin in DB: {e}")

    if not admin_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Admin not found.")

    updates = req.model_dump(exclude_unset=True)

    # Prevent self-demotion or self-deactivation by Super Admin
    if admin_id == current_admin.id:
        target_role = updates.get("role")
        if target_role is not None:
            role_val = target_role.value if hasattr(target_role, "value") else str(target_role)
            if role_val != AdminRole.SUPER_ADMIN.value:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="You cannot revoke your own Super Admin role.",
                )
        target_status = updates.get("status")
        if target_status is not None:
            status_val = target_status.value if hasattr(target_status, "value") else str(target_status)
            if status_val != AdminStatus.ACTIVE.value:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="You cannot deactivate or suspend your own account.",
                )

    if "password" in updates:
        if updates["password"]:
            updates["passwordHash"] = await get_password_hash_async(updates.pop("password"))
        else:
            updates.pop("password")

    if "role" in updates:
        updates["role"] = updates["role"].value if hasattr(updates["role"], "value") else str(updates["role"])
    if "status" in updates:
        updates["status"] = updates["status"].value if hasattr(updates["status"], "value") else str(updates["status"])

    now = utc_now()
    updates["updatedAt"] = now

    if db is not None:
        try:
            await db.admins.update_one({"_id": admin_id}, {"$set": updates})
        except Exception as e:
            logger.error(f"Failed to persist admin updates to MongoDB: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to update admin in database: {str(e)}"
            )

    memory_store.update_admin(admin_id, updates)

    # Record Audit
    memory_store.add_audit_log({
        "id": f"audit_{uuid.uuid4().hex[:12]}",
        "adminId": current_admin.id,
        "adminEmail": current_admin.email,
        "action": "ADMIN_UPDATED",
        "targetType": "ADMIN",
        "targetId": admin_id,
        "metadata": {k: str(v) for k, v in updates.items() if k != "passwordHash"},
        "createdAt": now
    })

    updated_doc = memory_store.get_admin_by_id(admin_id) or admin_doc
    return AdminResponse(
        id=admin_id,
        email=updated_doc["email"],
        name=updated_doc.get("name"),
        role=AdminRole(updated_doc.get("role", "ADMIN")),
        status=AdminStatus(updated_doc.get("status", "ACTIVE")),
        lastLoginAt=_parse_datetime(updated_doc.get("lastLoginAt") or admin_doc.get("lastLoginAt")),
        createdAt=_parse_datetime(updated_doc.get("createdAt") or admin_doc.get("createdAt"), default=now) or now,
        updatedAt=now
    )
