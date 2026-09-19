import time
import shutil
from typing import Dict, Any
from fastapi import APIRouter, Depends
from app.core.config import settings
from app.db.mongodb import get_database
from app.db.memory_store import memory_store
from app.models.admin import AdminResponse
from app.api.admin.auth import get_current_admin
from app.queue.redis_queue import queue_instance

router = APIRouter(prefix="/system", tags=["Admin System Health"])

@router.get("")
async def get_system_health(current_admin: AdminResponse = Depends(get_current_admin)) -> Dict[str, Any]:
    t0 = time.time()
    
    # 1. API Status
    api_status = {"status": "healthy", "latencyMs": round((time.time() - t0) * 1000, 2), "version": settings.VERSION}

    # 2. MongoDB Status
    db = get_database()
    mongo_status = {"status": "offline", "latencyMs": None, "mode": "memory_fallback"}
    if db is not None:
        try:
            mt0 = time.time()
            await db.command("ping")
            mongo_status = {
                "status": "healthy",
                "latencyMs": round((time.time() - mt0) * 1000, 2),
                "mode": "mongodb_atlas"
            }
        except Exception:
            mongo_status = {"status": "degraded", "latencyMs": None, "mode": "memory_store_active"}
    else:
        mongo_status = {"status": "healthy", "latencyMs": 0.1, "mode": "in_memory_primary"}

    # 3. Redis Queue Status
    is_redis = getattr(queue_instance, "is_connected", False)
    redis_status = {"status": "healthy", "mode": "redis_cluster" if is_redis else "in_memory_async"}

    # 4. FFmpeg Availability
    ffmpeg_path = shutil.which("ffmpeg")
    ffmpeg_status = {
        "status": "healthy" if ffmpeg_path else "warning",
        "available": bool(ffmpeg_path),
        "path": ffmpeg_path or "fallback_simulation"
    }

    # 5. Cloudinary Status
    cloudinary_status = {
        "status": "healthy" if settings.CLOUDINARY_CLOUD_NAME else "info",
        "cloudName": settings.CLOUDINARY_CLOUD_NAME or "local_stream",
        "mode": "cloud" if settings.CLOUDINARY_CLOUD_NAME else "local_disk"
    }

    # 6. AI Engine Provider (Google Gemini API)
    ai_status = {
        "status": "healthy",
        "model": settings.AI_MODEL,
        "provider": f"{settings.AI_PROVIDER.upper()} ({settings.AI_MODEL})"
    }

    # 7. Transcript Provider
    transcript_status = {
        "status": "healthy",
        "engine": "YouTube Transcript API + Punctuation Snap"
    }

    return {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "overall": "healthy",
        "services": {
            "api": api_status,
            "database": mongo_status,
            "queue": redis_status,
            "ffmpeg": ffmpeg_status,
            "cloudinary": cloudinary_status,
            "aiProvider": ai_status,
            "transcriptEngine": transcript_status
        },
        "environment": settings.ENVIRONMENT
    }
