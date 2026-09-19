from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict

class AuditLogCreate(BaseModel):
    adminId: str
    adminEmail: str
    action: str
    targetType: str
    targetId: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    ipAddress: Optional[str] = None

class AuditLogInDB(AuditLogCreate):
    id: str = Field(alias="_id")
    createdAt: datetime = Field(default_factory=datetime.utcnow)

    model_config = ConfigDict(populate_by_name=True)

class AuditLogResponse(AuditLogCreate):
    id: str
    createdAt: datetime
