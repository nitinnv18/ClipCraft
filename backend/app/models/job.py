from datetime import datetime
from typing import Optional, List
from enum import Enum
from pydantic import BaseModel, Field
from app.models.clip import ClipResponse

class JobStatus(str, Enum):
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class JobStage(str, Enum):
    INITIALIZING = "initializing"
    FETCHING = "fetching"
    TRANSCRIBING = "transcribing"
    ANALYZING = "analyzing"
    SELECTING = "selecting"
    RENDERING = "rendering"
    UPLOADING = "uploading"
    FINALIZING = "finalizing"
    COMPLETED = "completed"

class JobSettings(BaseModel):
    clipCount: int = Field(default=5, ge=1, le=10)
    minDuration: int = Field(default=30, ge=15, le=180)
    maxDuration: int = Field(default=60, ge=20, le=300)
    format: str = Field(default="9:16")
    captions: bool = Field(default=True)
    saveToCloud: bool = Field(default=False)

class JobCreateRequest(BaseModel):
    youtubeUrl: Optional[str] = None
    videoUrl: Optional[str] = None
    sourceType: str = Field(default="youtube")  # "youtube" | "upload" | "direct"
    clipCount: int = Field(default=5, ge=1, le=10)
    minDuration: int = Field(default=30, ge=15, le=180)
    maxDuration: int = Field(default=60, ge=20, le=300)
    format: str = Field(default="9:16")
    captions: bool = Field(default=True)
    saveToCloud: bool = Field(default=False)

class JobResponse(BaseModel):
    id: str
    userId: str
    youtubeUrl: Optional[str] = None
    videoId: Optional[str] = None
    sourceType: str = "youtube"
    title: str
    duration: float
    thumbnail: Optional[str] = None
    channel: Optional[str] = None
    status: JobStatus
    progress: int
    stage: JobStage
    clipCount: int
    estimatedSeconds: int = 60
    settings: JobSettings
    createdAt: datetime
    startedAt: Optional[datetime] = None
    completedAt: Optional[datetime] = None
    error: Optional[str] = None
    clips: Optional[List[ClipResponse]] = None
