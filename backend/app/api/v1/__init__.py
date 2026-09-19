from fastapi import APIRouter
from app.api.health import router as health_router
from app.api.auth import router as auth_router
from app.api.jobs import router as jobs_router
from app.api.media import router as media_router

# Admin Sub-routers
from app.api.admin.auth import router as admin_auth_router
from app.api.admin.dashboard import router as admin_dashboard_router
from app.api.admin.users import router as admin_users_router
from app.api.admin.jobs import router as admin_jobs_router
from app.api.admin.clips import router as admin_clips_router
from app.api.admin.storage import router as admin_storage_router
from app.api.admin.system import router as admin_system_router
from app.api.admin.logs import router as admin_logs_router
from app.api.admin.settings import router as admin_settings_router

api_router = APIRouter()

# User Routes
api_router.include_router(health_router)
api_router.include_router(auth_router)
api_router.include_router(jobs_router)
api_router.include_router(media_router)

# Admin Routes grouped under /admin
admin_router = APIRouter(prefix="/admin", tags=["Admin"])
admin_router.include_router(admin_auth_router)
admin_router.include_router(admin_dashboard_router)
admin_router.include_router(admin_users_router)
admin_router.include_router(admin_jobs_router)
admin_router.include_router(admin_clips_router)
admin_router.include_router(admin_storage_router)
admin_router.include_router(admin_system_router)
admin_router.include_router(admin_logs_router)
admin_router.include_router(admin_settings_router)

api_router.include_router(admin_router)
