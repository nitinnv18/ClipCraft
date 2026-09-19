from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "ClipCraft API"
    VERSION: str = "1.0.0"
    API_V1_PREFIX: str = "/api"
    ENVIRONMENT: str = "development"

    # Database
    MONGODB_URI: str = "mongodb://localhost:27017"
    MONGODB_DB_NAME: str = "clipcraft"

    # Redis Queue
    REDIS_URL: str = "redis://localhost:6379/0"

    # AI Provider Settings (Google Gemini API)
    AI_PROVIDER: str = "gemini"
    AI_API_KEY: Optional[str] = None
    AI_MODEL: str = "gemini-2.5-flash"

    # Google Gemini Configuration
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-2.5-flash"
    GEMINI_API_BASE: str = "https://generativelanguage.googleapis.com/v1beta"

    # Cloudinary
    CLOUDINARY_CLOUD_NAME: Optional[str] = None
    CLOUDINARY_API_KEY: Optional[str] = None
    CLOUDINARY_API_SECRET: Optional[str] = None

    # Security — JWT
    JWT_SECRET: str = "super-secret-clipcraft-production-key-change-me"
    JWT_ALGORITHM: str = "HS256"
    # User tokens: 24 hours; use ADMIN_TOKEN_EXPIRE_MINUTES for admin sessions
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24          # 24 hours
    ADMIN_TOKEN_EXPIRE_MINUTES: int = 60 * 8            # 8 hours for admin sessions

    # CORS — comma-separated list of allowed origins
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:3001"

    # Super Admin seed credentials (read from environment)
    SUPER_ADMIN_EMAIL: str = "admin@clipcraft.io"
    SUPER_ADMIN_PASSWORD: Optional[str] = None

    # App & Frontend URLs
    APP_URL: str = "http://localhost:3000"
    USER_APP_URL: str = "http://localhost:3000"
    ADMIN_APP_URL: str = "http://localhost:3001"
    TEMP_STORAGE_DIR: str = "./tmp_media"
    MAX_VIDEO_DURATION_SECONDS: int = 7200
    DEFAULT_CLIPS_PER_JOB: int = 5
    FREE_TIER_DAILY_LIMIT: int = 5

    # Storage Mode: "cloud" (Cloudinary CDN) or "local"
    STORAGE_MODE: str = "cloud"

    # YouTube Stream & RapidAPI Configuration (100% cloud bypass)
    RAPIDAPI_KEY: Optional[str] = None
    RAPIDAPI_HOST: Optional[str] = None

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore"
    )

settings = Settings()

