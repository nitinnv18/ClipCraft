from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, EmailStr, Field

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
    password: str = Field(..., min_length=8, max_length=72)

class AdminUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[AdminRole] = None
    status: Optional[AdminStatus] = None
    password: Optional[str] = Field(None, min_length=8, max_length=72)

class AdminLogin(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=72)

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
