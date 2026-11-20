from typing import Optional
from pydantic import model_validator
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

    # AI Provider Settings (Groq Cloud AI API)
    AI_PROVIDER: str = "groq"
    AI_API_KEY: Optional[str] = None
    AI_MODEL: str = "llama-3.3-70b-versatile"

    # Groq Cloud AI Configuration (Ultra-fast Whisper & Llama)
    GROQ_API_KEY: Optional[str] = None
    GROQ_API_BASE: str = "https://api.groq.com/openai/v1"
    GROQ_WHISPER_MODEL: str = "whisper-large-v3-turbo"
    GROQ_CHAT_MODEL: str = "llama-3.3-70b-versatile"

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

    # CORS — comma-separated list of allowed origins and regex whitelist
    ALLOWED_ORIGINS: str = (
        "http://localhost:3000,http://localhost:3001,"
        "https://clipcraft.vercel.app,"
        "https://clipcraft-v1.vercel.app,"
        "https://clipcraft-v1-admin.vercel.app,"
        "https://clipcraft-admin.vercel.app"
    )
    ALLOWED_ORIGIN_REGEX: Optional[str] = r"^https:\/\/(?:clipcraft|clipcraft-admin|clipcraft-v1|clipcraft-v1-admin)(?:-[a-zA-Z0-9]+)?\.vercel\.app$"

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

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore"
    )

    @model_validator(mode="after")
    def validate_production_security(self) -> "Settings":
        if self.ENVIRONMENT.lower() != "development":
            insecure_secrets = {
                "super-secret-clipcraft-production-key-change-me",
                "secret",
                "changeme",
                "default",
                "password",
            }
            if not self.JWT_SECRET or self.JWT_SECRET.strip() in insecure_secrets or len(self.JWT_SECRET.strip()) < 16:
                raise ValueError(
                    "CRITICAL SECURITY CONFIGURATION ERROR: "
                    f"Cannot run in '{self.ENVIRONMENT}' mode with unset, default, or insecure JWT_SECRET. "
                    "Please set a strong, unique JWT_SECRET in your environment variables."
                )
        return self

settings = Settings()

