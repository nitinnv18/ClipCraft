from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler  # type: ignore
from slowapi.errors import RateLimitExceeded  # type: ignore
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
    await connect_to_mongo()
    await queue_instance.initialize()
    await seed_default_super_admin()
    yield
    logger.info(f"Shutting down {settings.PROJECT_NAME}...")
    await close_mongo_connection()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="ClipCraft API — Enterprise Automatic Short Clips Platform",
    lifespan=lifespan
)

# Rate limiter state + handler
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS Middleware — configured for local dev and Vercel cloud deployments
allowed_origins = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"^https:\/\/.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

# Security Headers Middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
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

