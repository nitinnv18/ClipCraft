import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, status
from app.db.mongodb import get_database
from app.db.memory_store import memory_store
from app.models.admin import AdminResponse, AdminRole, AdminCreate, AdminUpdate, AdminStatus
from app.models.system_setting import SystemSettings, SystemSettingsUpdate
from app.api.admin.auth import get_current_admin, require_roles
from app.core.security import get_password_hash
from app.core.logging import logger

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
        except Exception:
            pass
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

    updates["updatedBy"] = current_admin.email
    updates["updatedAt"] = datetime.utcnow()

    memory_store.update_settings(updates, updated_by=current_admin.email)
    if db is not None:
        try:
            await db.system_settings.update_one(
                {"_id": "global_config"},
                {"$set": updates},
                upsert=True
            )
        except Exception:
            pass

    # Record Audit Log
    memory_store.add_audit_log({
        "id": f"audit_{uuid.uuid4().hex[:12]}",
        "adminId": current_admin.id,
        "adminEmail": current_admin.email,
        "action": "SETTINGS_UPDATED",
        "targetType": "SETTINGS",
        "targetId": "global_config",
        "metadata": updates,
        "createdAt": datetime.utcnow()
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
            mongo_admins = await db.admins.find({}).to_list(100)
            if mongo_admins:
                all_admins = mongo_admins
        except Exception:
            pass

    results = []
    for a in all_admins:
        created_at = a.get("createdAt")
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at)
        updated_at = a.get("updatedAt")
        if isinstance(updated_at, str):
            updated_at = datetime.fromisoformat(updated_at)
        last_login = a.get("lastLoginAt")
        if isinstance(last_login, str):
            last_login = datetime.fromisoformat(last_login)

        results.append(
            AdminResponse(
                id=str(a.get("id") or a.get("_id")),
                email=a.get("email"),
                name=a.get("name"),
                role=AdminRole(a.get("role", "ADMIN")),
                status=AdminStatus(a.get("status", "ACTIVE")),
                lastLoginAt=last_login,
                createdAt=created_at or datetime.utcnow(),
                updatedAt=updated_at or datetime.utcnow()
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
        raise HTTPException(status_code=400, detail="Admin account with this email already exists.")

    admin_id = f"admin_{uuid.uuid4().hex[:12]}"
    now = datetime.utcnow()
    admin_doc = {
        "_id": admin_id,
        "id": admin_id,
        "email": email,
        "name": req.name or email.split("@")[0],
        "passwordHash": get_password_hash(req.password),
        "role": req.role.value,
        "status": AdminStatus.ACTIVE.value,
        "lastLoginAt": None,
        "createdAt": now,
        "updatedAt": now
    }

    memory_store.set_admin(admin_id, admin_doc)
    if db is not None:
        try:
            await db.admins.insert_one(admin_doc)
        except Exception:
            pass

    # Record Audit
    memory_store.add_audit_log({
        "id": f"audit_{uuid.uuid4().hex[:12]}",
        "adminId": current_admin.id,
        "adminEmail": current_admin.email,
        "action": "ADMIN_CREATED",
        "targetType": "ADMIN",
        "targetId": admin_id,
        "metadata": {"email": email, "role": req.role.value},
        "createdAt": now
    })

    logger.info(f"New admin created by {current_admin.email}: {email} ({req.role.value})")
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
        except Exception:
            pass

    if not admin_doc:
        raise HTTPException(status_code=404, detail="Admin not found.")

    updates = req.model_dump(exclude_unset=True)
    if "password" in updates and updates["password"]:
        updates["passwordHash"] = get_password_hash(updates.pop("password"))
    if "role" in updates:
        updates["role"] = updates["role"].value if hasattr(updates["role"], "value") else str(updates["role"])
    if "status" in updates:
        updates["status"] = updates["status"].value if hasattr(updates["status"], "value") else str(updates["status"])

    now = datetime.utcnow()
    updates["updatedAt"] = now

    memory_store.update_admin(admin_id, updates)
    if db is not None:
        try:
            await db.admins.update_one({"_id": admin_id}, {"$set": updates})
        except Exception:
            pass

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
        lastLoginAt=None,
        createdAt=now,
        updatedAt=now
    )
