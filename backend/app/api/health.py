import shutil
from typing import Optional
from fastapi import APIRouter
from app.db.mongodb import db_instance
from app.queue.redis_queue import queue_instance
from app.core.config import settings

router = APIRouter()
_ffmpeg_cached: Optional[bool] = None

def _is_ffmpeg_installed() -> bool:
    global _ffmpeg_cached
    if _ffmpeg_cached is None:
        _ffmpeg_cached = bool(shutil.which("ffmpeg"))
    return _ffmpeg_cached

@router.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "mongodb": "connected" if db_instance.is_connected else "disconnected",
        "redis": "connected" if queue_instance.is_connected else "in-memory-fallback",
        "ffmpeg": "available" if _is_ffmpeg_installed() else "unavailable",
        "cloudinary": "configured" if settings.CLOUDINARY_CLOUD_NAME else "local-storage"
    }
