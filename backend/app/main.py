import re
from typing import Optional
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler  # type: ignore
from slowapi.errors import RateLimitExceeded  # type: ignore
from slowapi.middleware import SlowAPIMiddleware  # type: ignore
from app.core.config import settings
from app.core.logging import setup_logging, logger
from app.db.mongodb import connect_to_mongo, close_mongo_connection
from app.queue.redis_queue import queue_instance
from app.api.admin.auth import seed_default_super_admin
from app.api.v1 import api_router
from app.middleware.rate_limit import limiter

# Setup structured logger
setup_logging()

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting {settings.PROJECT_NAME} v{settings.VERSION} [{settings.ENVIRONMENT}]...")
    # Clean up any leftover temporary media files from previous interrupted runs
    from app.core.utils import cleanup_orphaned_temp_files
    cleaned = cleanup_orphaned_temp_files(settings.TEMP_STORAGE_DIR, max_age_hours=2.0)
    if cleaned > 0:
        logger.info(f"Cleaned up {cleaned} orphaned temporary media directories/files on startup.")
    await connect_to_mongo()
    await queue_instance.initialize()
    await seed_default_super_admin()
    import os
    import asyncio

    # Launch in-process worker daemon (enabled by default so single-container deployments always process queues)
    worker_task = None
    enable_worker = os.getenv("ENABLE_INPROCESS_WORKER", "true").lower() in ("true", "1")
    if enable_worker:
        from app.workers.video_worker import start_worker_daemon
        worker_task = asyncio.create_task(start_worker_daemon())
        logger.info("Video processing worker daemon task launched in background.")

    # Automatic Reaper for Stale / Zombie Jobs (cleans up any jobs stuck in queue/processing)
    async def reap_stale_jobs(max_age_minutes: float = 20.0):
        from datetime import datetime, timedelta
        from app.db.mongodb import get_database
        from app.db.memory_store import memory_store
        cutoff = datetime.utcnow() - timedelta(minutes=max_age_minutes)
        db = get_database()
        stuck_statuses = ["queued", "processing", "fetching", "transcribing", "analyzing", "rendering", "uploading"]

        # 1. Clean up in MongoDB
        if db is not None:
            try:
                res = await db.jobs.update_many(
                    {
                        "status": {"$in": stuck_statuses},
                        "$or": [
                            {"updatedAt": {"$lt": cutoff}},
                            {"updatedAt": {"$exists": False}, "createdAt": {"$lt": cutoff}},
                            {"updatedAt": None, "createdAt": {"$lt": cutoff}}
                        ]
                    },
                    {
                        "$set": {
                            "status": "failed",
                            "stage": "finalizing",
                            "error": "Job timed out or worker process disconnected.",
                            "completedAt": datetime.utcnow(),
                            "updatedAt": datetime.utcnow()
                        }
                    }
                )
                if res.modified_count > 0:
                    logger.warning(f"🧹 Reaped and marked {res.modified_count} stale/zombie jobs as failed in MongoDB.")
            except Exception as e:
                logger.error(f"Error reaping stale jobs from MongoDB: {e}")

        # 2. Clean up in memory_store
        for jid, j in list(memory_store.jobs.items()):
            st = str(j.get("status", "")).lower()
            if st in stuck_statuses:
                dt = j.get("updatedAt") or j.get("createdAt")
                if isinstance(dt, datetime) and dt < cutoff:
                    memory_store.update_job(jid, {
                        "status": "failed",
                        "stage": "finalizing",
                        "error": "Job timed out or worker process disconnected.",
                        "completedAt": datetime.utcnow(),
                        "updatedAt": datetime.utcnow()
                    })

    # Sweep stuck jobs immediately on startup
    await reap_stale_jobs(max_age_minutes=20.0)

    # Periodic background tasks (stale job reaper every 2 minutes, file cleanup every 6 hours)
    async def periodic_job_reaper():
        try:
            while True:
                await asyncio.sleep(120)
                await reap_stale_jobs(max_age_minutes=20.0)
        except asyncio.CancelledError:
            pass

    async def periodic_temp_cleanup():
        try:
            while True:
                await asyncio.sleep(6 * 3600)
                await asyncio.to_thread(cleanup_orphaned_temp_files, settings.TEMP_STORAGE_DIR, 2.0)
        except asyncio.CancelledError:
            pass

    reaper_task = asyncio.create_task(periodic_job_reaper())
    cleanup_task = asyncio.create_task(periodic_temp_cleanup())

    yield
    logger.info(f"Shutting down {settings.PROJECT_NAME}...")
    reaper_task.cancel()
    cleanup_task.cancel()
    if worker_task:
        worker_task.cancel()
        try:
            await worker_task
        except asyncio.CancelledError:
            pass
    from app.core.http_client import close_http_client
    await close_http_client()
    await queue_instance.close()
    await close_mongo_connection()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="ClipCraft API — Enterprise Automatic Short Clips Platform",
    lifespan=lifespan,
    docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
    openapi_url="/openapi.json" if settings.ENVIRONMENT != "production" else None,
)

# CORS Middleware — configured for local dev and official domain deployments
allowed_origins = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",") if o.strip()]

def is_origin_allowed(origin: Optional[str]) -> bool:
    if not origin:
        return False
    if origin in allowed_origins:
        return True
    if settings.ALLOWED_ORIGIN_REGEX and re.match(settings.ALLOWED_ORIGIN_REGEX, origin):
        return True
    return False

# Rate limiter state + handler
app.state.limiter = limiter

def safe_rate_limit_exceeded_handler(request: Request, exc: Exception) -> JSONResponse:
    detail = getattr(exc, "detail", "Too many requests. Please try again later.")
    response = JSONResponse(
        status_code=429,
        content={"detail": f"Rate limit exceeded: {detail}"}
    )
    origin = request.headers.get("origin")
    if is_origin_allowed(origin):
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
    return response

app.add_exception_handler(RateLimitExceeded, safe_rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

cors_kwargs = {
    "allow_origins": allowed_origins,
    "allow_credentials": True,
    "allow_methods": ["*"],
    "allow_headers": ["*"],
}
if settings.ALLOWED_ORIGIN_REGEX:
    cors_kwargs["allow_origin_regex"] = settings.ALLOWED_ORIGIN_REGEX

app.add_middleware(
    CORSMiddleware,
    **cors_kwargs,
)

# Security Headers & Global CORS Error Guard Middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    try:
        response = await call_next(request)
    except Exception as exc:
        logger.error(f"Unhandled error processing {request.method} {request.url.path}: {exc}", exc_info=True)
        origin = request.headers.get("origin")
        err_content = {"detail": "An internal server error occurred."}
        if settings.ENVIRONMENT != "production":
            err_content["error"] = str(exc)
        response = JSONResponse(
            status_code=500,
            content=err_content,
        )
        if is_origin_allowed(origin):
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if settings.ENVIRONMENT == "production":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

# Root Endpoint
@app.get("/")
async def root():
    return {"message": "ClipCraft API is operational.", "status": "ok", "version": settings.VERSION}

# Mount unified v1 API routes under /api
app.include_router(api_router, prefix=settings.API_V1_PREFIX)

# Also mount health on root for direct liveness probes
from app.api.health import router as health_router
app.include_router(health_router)

