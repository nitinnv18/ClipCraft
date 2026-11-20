from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, Query
from app.db.mongodb import get_database
from app.db.memory_store import memory_store
from app.models.admin import AdminResponse
from app.api.admin.auth import get_current_admin
from app.core.utils import format_iso_utc

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

    if search and isinstance(search, str):
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
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    current_admin: AdminResponse = Depends(get_current_admin)
) -> Dict[str, Any]:
    db = get_database()
    query: Dict[str, Any] = {}
    if action:
        query["action"] = action
    if admin_id:
        query["adminId"] = admin_id

    skip = (page - 1) * limit
    total = 0
    audit_logs = []
    if db is not None:
        try:
            total = await db.audit_logs.count_documents(query)
            mongo_audits = await db.audit_logs.find(query).sort("createdAt", -1).skip(skip).to_list(limit)
            if mongo_audits:
                audit_logs = mongo_audits
        except Exception:
            pass

    if not audit_logs and db is None:
        mem_logs = memory_store.get_audit_logs(limit=1000)
        if action:
            mem_logs = [a for a in mem_logs if a.get("action") == action]
        if admin_id:
            mem_logs = [a for a in mem_logs if str(a.get("adminId")) == admin_id]
        total = len(mem_logs)
        audit_logs = mem_logs[skip : skip + limit]

    rows = []
    for a in audit_logs:
        rows.append({
            "id": str(a.get("id") or a.get("_id")),
            "adminId": str(a.get("adminId", "")),
            "adminEmail": a.get("adminEmail", "system"),
            "action": a.get("action", "ACTION"),
            "targetType": a.get("targetType", "GENERAL"),
            "targetId": str(a.get("targetId", "")) if a.get("targetId") else None,
            "metadata": a.get("metadata", {}),
            "createdAt": format_iso_utc(a.get("createdAt"))
        })

    import math
    pages = math.ceil(total / limit) if limit > 0 and total > 0 else 1

    return {
        "auditLogs": rows,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": pages,
        "count": len(rows)
    }
