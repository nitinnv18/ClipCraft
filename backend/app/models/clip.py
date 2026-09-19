from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel, Field, ConfigDict

class ClipCandidate(BaseModel):
    start: float
    end: float
    duration: Optional[float] = None
    title: str = "Viral Highlight"
    hook: Optional[str] = "Key moment in video"
    description: Optional[str] = None
    reason: Optional[str] = "High engagement sequence"
    category: Optional[str] = "insight"
    score: int = Field(default=85, ge=0, le=100)

    def model_post_init(self, __context: Any) -> None:
        if self.duration is None or self.duration <= 0:
            self.duration = round(max(0.0, self.end - self.start), 2)
        if not self.description:
            self.description = self.reason or self.hook or "Key video highlight"

class Clip(BaseModel):
    id: str = Field(alias="_id")
    jobId: str
    userId: Optional[str] = None
    startTime: float
    endTime: float
    duration: float
    title: str
    hook: str
    description: str
    reason: Optional[str] = None
    category: Optional[str] = "insight"
    score: int
    cloudinaryPublicId: Optional[str] = None
    videoUrl: str
    thumbnailUrl: Optional[str] = None
    captionsText: Optional[str] = None
    segments: Optional[list] = None
    createdAt: datetime = Field(default_factory=datetime.utcnow)

    model_config = ConfigDict(populate_by_name=True)

class ClipResponse(BaseModel):
    id: str
    jobId: str
    userId: Optional[str] = None
    startTime: float
    endTime: float
    duration: float
    title: str
    hook: str
    description: str
    reason: Optional[str] = None
    category: Optional[str] = "insight"
    score: int
    videoUrl: str
    thumbnailUrl: Optional[str] = None
    captionsText: Optional[str] = None
    segments: Optional[list] = None
    createdAt: datetime
