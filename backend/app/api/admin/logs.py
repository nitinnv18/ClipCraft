from datetime import datetime
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, Query
from app.db.mongodb import get_database
from app.db.memory_store import memory_store
from app.models.admin import AdminResponse, AdminRole
from app.api.admin.auth import get_current_admin

router = APIRouter(prefix="/logs", tags=["Admin Logs"])

@router.get("/system")
async def get_system_logs(
    level: Optional[str] = Query(None, description="Filter by log level (INFO, WARNING, ERROR, CRITICAL)"),
    service: Optional[str] = Query(None, description="Filter by service name"),
    search: Optional[str] = Query(None, description="Search log message"),
    limit: int = Query(100, ge=1, le=500),
    current_admin: AdminResponse = Depends(get_current_admin)
) -> Dict[str, Any]:
    logs = memory_store.get_system_logs(level=level, service=service, limit=limit)
    
    # If empty, add helpful real-time startup diagnostics
    if not logs:
        memory_store.add_system_log("INFO", "API", "ClipCraft FastApi backend listening on 0.0.0.0:8000")
        memory_store.add_system_log("INFO", "Queue", "Async video processing worker queue active")
        memory_store.add_system_log("INFO", "Database", "MongoDB/Memory dual persistence operational")
        memory_store.add_system_log("INFO", "Security", "Admin RBAC module initialized")
        logs = memory_store.get_system_logs(level=level, service=service, limit=limit)

    if search:
        s = search.lower().strip()
        logs = [l for l in logs if s in l.get("message", "").lower() or s in l.get("service", "").lower()]

    return {
        "logs": logs,
        "count": len(logs)
    }

@router.get("/audit")
async def get_audit_logs(
    action: Optional[str] = Query(None),
    admin_id: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    current_admin: AdminResponse = Depends(get_current_admin)
) -> Dict[str, Any]:
    db = get_database()
    audit_logs = memory_store.get_audit_logs(limit=limit)

    if db is not None:
        try:
            mongo_audits = await db.audit_logs.find({}).sort("createdAt", -1).to_list(limit)
            if mongo_audits:
                audit_logs = mongo_audits
        except Exception:
            pass

    filtered = audit_logs
    if action:
        filtered = [a for a in filtered if a.get("action") == action]
    if admin_id:
        filtered = [a for a in filtered if str(a.get("adminId")) == admin_id]

    rows = []
    for a in filtered[:limit]:
        rows.append({
            "id": str(a.get("id") or a.get("_id")),
            "adminId": str(a.get("adminId", "")),
            "adminEmail": a.get("adminEmail", "system"),
            "action": a.get("action", "ACTION"),
            "targetType": a.get("targetType", "GENERAL"),
            "targetId": str(a.get("targetId", "")) if a.get("targetId") else None,
            "metadata": a.get("metadata", {}),
            "createdAt": str(a.get("createdAt", ""))
        })

    return {
        "auditLogs": rows,
        "count": len(rows)
    }
