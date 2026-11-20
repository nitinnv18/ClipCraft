from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field

class SystemSettings(BaseModel):
    # General
    projectName: str = "ClipCraft"
    maintenanceMode: bool = False
    maintenanceMessage: str = "ClipCraft is temporarily undergoing scheduled maintenance. Please check back shortly."
    supportEmail: str = "support@clipcraft.io"

    # Usage Limits
    freeTierDailyLimit: int = 5
    maxClipsPerJob: int = 10
    maxVideoDurationSeconds: int = 7200
    allowAnonymousPreviews: bool = True

    # Processing & Concurrency
    maxConcurrentWorkers: int = 4
    jobTimeoutSeconds: int = 900
    maxRetryAttempts: int = 3
    overlapDeduplicationThreshold: int = 25
    sentenceSnapBoundarySeconds: float = 3.0

    # Storage & Retention
    retentionDays: int = 30
    autoCleanupOrphanedMedia: bool = True
    maxUserStorageBytes: int = 10737418240  # 10 GB

    # Security
    sessionTimeoutMinutes: int = 1440  # 24 hours
    requireAdmin2FA: bool = False
    maxLoginAttempts: int = 5

    updatedBy: Optional[str] = "system"
    updatedAt: datetime = Field(default_factory=datetime.utcnow)

class SystemSettingsUpdate(BaseModel):
    projectName: Optional[str] = None
    maintenanceMode: Optional[bool] = None
    maintenanceMessage: Optional[str] = None
    supportEmail: Optional[str] = None
    freeTierDailyLimit: Optional[int] = None
    maxClipsPerJob: Optional[int] = None
    maxVideoDurationSeconds: Optional[int] = None
    allowAnonymousPreviews: Optional[bool] = None
    maxConcurrentWorkers: Optional[int] = None
    jobTimeoutSeconds: Optional[int] = None
    maxRetryAttempts: Optional[int] = None
    overlapDeduplicationThreshold: Optional[int] = None
    sentenceSnapBoundarySeconds: Optional[float] = None
    retentionDays: Optional[int] = None
    autoCleanupOrphanedMedia: Optional[bool] = None
    maxUserStorageBytes: Optional[int] = None
    sessionTimeoutMinutes: Optional[int] = None
    requireAdmin2FA: Optional[bool] = None
    maxLoginAttempts: Optional[int] = None
