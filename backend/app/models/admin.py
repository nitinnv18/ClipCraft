from datetime import datetime
from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field, ConfigDict

class AdminRole(str, Enum):
    SUPER_ADMIN = "SUPER_ADMIN"
    ADMIN = "ADMIN"
    SUPPORT = "SUPPORT"

class AdminStatus(str, Enum):
    ACTIVE = "ACTIVE"
    SUSPENDED = "SUSPENDED"

class AdminBase(BaseModel):
    email: EmailStr
    name: Optional[str] = None
    role: AdminRole = AdminRole.ADMIN

class AdminCreate(AdminBase):
    password: str = Field(..., min_length=8)

class AdminUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[AdminRole] = None
    status: Optional[AdminStatus] = None
    password: Optional[str] = Field(None, min_length=8)

class AdminLogin(BaseModel):
    email: EmailStr
    password: str

class AdminInDB(AdminBase):
    id: str = Field(alias="_id")
    passwordHash: str
    status: AdminStatus = AdminStatus.ACTIVE
    lastLoginAt: Optional[datetime] = None
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    updatedAt: datetime = Field(default_factory=datetime.utcnow)

    model_config = ConfigDict(populate_by_name=True)

class AdminResponse(AdminBase):
    id: str
    status: AdminStatus
    lastLoginAt: Optional[datetime] = None
    createdAt: datetime
    updatedAt: datetime

class AdminTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    admin: AdminResponse
