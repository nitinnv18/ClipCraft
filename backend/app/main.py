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
from app.db.mongodb import connect_to_mongo, close_mongo_connection, db_instance
from app.queue.redis_queue import queue_instance
from app.api.admin.auth import seed_default_super_admin
from app.api.v1 import api_router
from app.middleware.rate_limit import limiter

# Setup structured logger
setup_logging()

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"🚀 Initializing {settings.PROJECT_NAME} v{settings.VERSION} [{settings.ENVIRONMENT.upper()}]...")
    # Clean up any leftover temporary media files from previous interrupted runs
    from app.core.utils import cleanup_orphaned_temp_files
    cleaned = cleanup_orphaned_temp_files(settings.TEMP_STORAGE_DIR, max_age_hours=2.0)
    if cleaned > 0:
        logger.info(f"🧹 Cleaned up {cleaned} orphaned temporary media files on startup.")
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
        logger.info("⚙️ Video processing worker daemon active in background.")

    # Automatic Reaper for Stale / Zombie Jobs (cleans up any jobs stuck in queue/processing)
    async def reap_stale_jobs(server_max_age_minutes: float = 15.0, client_max_age_minutes: float = 4.0):
        from datetime import datetime, timedelta
        from app.db.mongodb import get_database
        from app.db.memory_store import memory_store
        now = datetime.utcnow()
        server_cutoff = now - timedelta(minutes=server_max_age_minutes)
        client_cutoff = now - timedelta(minutes=client_max_age_minutes)
        db = get_database()
        stuck_statuses = ["queued", "processing", "fetching", "transcribing", "analyzing", "rendering", "uploading"]

        # 1. Clean up in MongoDB
        if db is not None:
            try:
                # A. Sweep abandoned on-device jobs (> 4 minutes inactive)
                res_client = await db.jobs.update_many(
                    {
                        "status": {"$in": stuck_statuses},
                        "$and": [
                            {
                                "$or": [
                                    {"channel": "Local Device"},
                                    {"videoId": "client_render"},
                                    {"sourceType": "upload"}
                                ]
                            },
                            {
                                "$or": [
                                    {"updatedAt": {"$lt": client_cutoff}},
                                    {"updatedAt": {"$exists": False}, "createdAt": {"$lt": client_cutoff}},
                                    {"updatedAt": None, "createdAt": {"$lt": client_cutoff}}
                                ]
                            }
                        ]
                    },
                    {
                        "$set": {
                            "status": "failed",
                            "stage": "finalizing",
                            "error": "Processing stopped: Browser tab was closed or disconnected.",
                            "completedAt": now,
                            "updatedAt": now
                        }
                    }
                )
                if res_client.modified_count > 0:
                    logger.warning(f"🧹 Reaped {res_client.modified_count} abandoned on-device jobs in MongoDB.")

                # B. Sweep stale server jobs (> 15 minutes inactive)
                res_server = await db.jobs.update_many(
                    {
                        "status": {"$in": stuck_statuses},
                        "$or": [
                            {"updatedAt": {"$lt": server_cutoff}},
                            {"updatedAt": {"$exists": False}, "createdAt": {"$lt": server_cutoff}},
                            {"updatedAt": None, "createdAt": {"$lt": server_cutoff}}
                        ]
                    },
                    {
                        "$set": {
                            "status": "failed",
                            "stage": "finalizing",
                            "error": "Job timed out or worker process disconnected.",
                            "completedAt": now,
                            "updatedAt": now
                        }
                    }
                )
                if res_server.modified_count > 0:
                    logger.warning(f"🧹 Reaped {res_server.modified_count} stale server jobs in MongoDB.")
            except Exception as e:
                err_msg = str(e)
                if "cancelled" in err_msg.lower():
                    logger.debug(f"MongoDB reaper operation cancelled during sweep: {err_msg}")
                else:
                    logger.warning(f"Notice while reaping stale jobs from MongoDB: {e}")

        # 2. Clean up in memory_store
        for jid, j in list(memory_store.jobs.items()):
            st = str(j.get("status", "")).lower()
            if st in stuck_statuses:
                is_client = j.get("videoId") == "client_render" or j.get("channel") == "Local Device"
                active_cutoff = client_cutoff if is_client else server_cutoff
                dt = j.get("updatedAt") or j.get("createdAt")
                if isinstance(dt, datetime) and dt < active_cutoff:
                    err_msg = (
                        "Processing stopped: Browser tab was closed or disconnected."
                        if is_client
                        else "Job timed out or worker process disconnected."
                    )
                    memory_store.update_job(jid, {
                        "status": "failed",
                        "stage": "finalizing",
                        "error": err_msg,
                        "completedAt": now,
                        "updatedAt": now
                    })

    # Sweep stuck jobs immediately on startup (resilient thresholds: server 25m, client 15m)
    await reap_stale_jobs(server_max_age_minutes=25.0, client_max_age_minutes=15.0)

    # Periodic background tasks (stale job reaper every 2 minutes, file cleanup every 6 hours)
    async def periodic_job_reaper():
        try:
            while True:
                await asyncio.sleep(120)
                await reap_stale_jobs(server_max_age_minutes=25.0, client_max_age_minutes=15.0)
        except asyncio.CancelledError:
            pass

    async def periodic_temp_cleanup():
        try:
            while True:
                await asyncio.sleep(6 * 3600)
                await asyncio.to_thread(cleanup_orphaned_temp_files, settings.TEMP_STORAGE_DIR, 2.0)
        except asyncio.CancelledError:
            pass

    async def periodic_self_ping():
        """Keeps Render / cloud free-tier web services from sleeping by self-pinging its public URL."""
        if not settings.SELF_PING_ENABLED:
            return

        # Render automatically sets RENDER_EXTERNAL_URL (e.g., https://clipcraft.onrender.com)
        ping_url = settings.SELF_PING_URL or os.getenv("RENDER_EXTERNAL_URL")
        if not ping_url:
            return

        target = ping_url.rstrip("/")
        if not target.endswith("/health") and not target.endswith("/api/health"):
            target = f"{target}/api/health"

        import httpx
        logger.info(f"⚡ Self-ping service enabled: pinging {target} every {settings.SELF_PING_INTERVAL_SECONDS}s to prevent idle sleep.")

        try:
            # Initial wait before starting pings
            await asyncio.sleep(60)
            while True:
                try:
                    async with httpx.AsyncClient(timeout=15.0) as client:
                        resp = await client.get(target)
                        if resp.status_code == 200:
                            logger.info(f"⚡ Self-ping sent successfully to {target} (Status 200)")
                        else:
                            logger.warning(f"⚡ Self-ping to {target} returned status {resp.status_code}")
                except Exception as ping_err:
                    logger.warning(f"⚡ Self-ping notification failed: {ping_err}")
                await asyncio.sleep(settings.SELF_PING_INTERVAL_SECONDS)
        except asyncio.CancelledError:
            pass

    reaper_task = asyncio.create_task(periodic_job_reaper())
    cleanup_task = asyncio.create_task(periodic_temp_cleanup())
    self_ping_task = asyncio.create_task(periodic_self_ping())

    # Enterprise Startup Diagnostic Summary
    mongo_status = "Connected" if getattr(db_instance, "is_connected", False) else "Fallback / In-Memory"
    redis_status = "Connected" if getattr(queue_instance, "is_connected", False) else "Fallback / In-Memory"
    storage_desc = "Cloudinary CDN (Cloud)" if (settings.STORAGE_MODE == "cloud" and settings.CLOUDINARY_CLOUD_NAME) else "Local File Storage"

    sep = "─" * 60
    logger.info(sep)
    logger.info(f"🚀 {settings.PROJECT_NAME} v{settings.VERSION} [{settings.ENVIRONMENT.upper()}] - READY")
    logger.info(sep)
    logger.info(f"🍃 Database:        MongoDB [{mongo_status}] - {settings.MONGODB_DB_NAME}")
    logger.info(f"⚡ Queue & Cache:   Redis [{redis_status}]")
    logger.info(f"💾 Media Storage:   {storage_desc}")
    logger.info(f"🤖 AI Engine:      {settings.AI_PROVIDER.upper()} ({settings.GROQ_CHAT_MODEL})")
    logger.info(f"🎙️ Speech AI:      Groq Whisper ({settings.GROQ_WHISPER_MODEL})")
    logger.info(f"⚙️ Worker Task:    {'Active (In-Process)' if enable_worker else 'Standalone Service'}")
    logger.info(f"🧹 Zombie Reaper:  Active (Interval: 120s)")
    logger.info("🛡️ Healthcheck:    Silenced routine 200s (zero log spam)")
    logger.info(sep)

    yield
    logger.info(f"Shutting down {settings.PROJECT_NAME}...")
    reaper_task.cancel()
    cleanup_task.cancel()
    self_ping_task.cancel()
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

# CORS Middleware — dynamic from ALLOWED_ORIGINS environment variable
if settings.ALLOWED_ORIGINS:
    allowed_origins = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",") if o.strip()]
elif settings.ENVIRONMENT.lower() == "development":
    allowed_origins = ["http://localhost:3000", "http://localhost:3001"]
else:
    allowed_origins = []

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
@app.api_route("/", methods=["GET", "HEAD"])
async def root():
    return {"message": "ClipCraft API is operational.", "status": "ok", "version": settings.VERSION}

# Mount unified v1 API routes under /api
app.include_router(api_router, prefix=settings.API_V1_PREFIX)

# Also mount health on root for direct liveness probes
from app.api.health import router as health_router
app.include_router(health_router)

