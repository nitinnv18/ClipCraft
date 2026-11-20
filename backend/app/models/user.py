from datetime import datetime
from pydantic import BaseModel, EmailStr, Field

class UserBase(BaseModel):
    email: EmailStr

class UserCreate(UserBase):
    password: str = Field(..., min_length=6, max_length=72)

class UserLogin(UserBase):
    password: str = Field(..., min_length=1, max_length=72)

class UserResponse(UserBase):
    id: str
    status: str = "active"
    createdAt: datetime

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
