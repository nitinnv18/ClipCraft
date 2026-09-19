from fastapi import APIRouter
from app.db.mongodb import db_instance
from app.queue.redis_queue import queue_instance
from app.providers.video.ffmpeg_processor import FFmpegVideoProcessor
from app.core.config import settings

router = APIRouter()
video_proc = FFmpegVideoProcessor()

@router.get("/health")
async def health_check():
    ffmpeg_ok = await video_proc.check_ffmpeg_installed()
    return {
        "status": "ok",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "mongodb": "connected" if db_instance.is_connected else "disconnected",
        "redis": "connected" if queue_instance.is_connected else "in-memory-fallback",
        "ffmpeg": "available" if ffmpeg_ok else "unavailable",
        "cloudinary": "configured" if settings.CLOUDINARY_CLOUD_NAME else "local-storage"
    }
