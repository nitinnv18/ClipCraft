from typing import Optional
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "ClipCraft API"
    VERSION: str = "1.0.0"
    API_V1_PREFIX: str = "/api"
    ENVIRONMENT: str = "development"

    # Database
    MONGODB_URI: Optional[str] = None
    MONGODB_DB_NAME: str = "clipcraft"

    # Redis Queue
    REDIS_URL: Optional[str] = None

    # AI Provider Settings (Groq Cloud AI API)
    AI_PROVIDER: str = "groq"
    AI_API_KEY: Optional[str] = None
    AI_MODEL: str = "openai/gpt-oss-120b"

    # Groq Cloud AI Configuration (Ultra-fast Whisper & Llama)
    GROQ_API_KEY: Optional[str] = None
    GROQ_API_BASE: str = "https://api.groq.com/openai/v1"
    GROQ_WHISPER_MODEL: str = "whisper-large-v3-turbo"
    GROQ_CHAT_MODEL: str = "openai/gpt-oss-120b"

    # Cloudinary
    CLOUDINARY_CLOUD_NAME: Optional[str] = None
    CLOUDINARY_API_KEY: Optional[str] = None
    CLOUDINARY_API_SECRET: Optional[str] = None

    # Security — JWT
    JWT_SECRET: Optional[str] = None
    JWT_ALGORITHM: str = "HS256"
    # User tokens: 24 hours; use ADMIN_TOKEN_EXPIRE_MINUTES for admin sessions
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24          # 24 hours
    ADMIN_TOKEN_EXPIRE_MINUTES: int = 60 * 8            # 8 hours for admin sessions

    # CORS — comma-separated list of allowed origins and regex whitelist
    ALLOWED_ORIGINS: Optional[str] = None
    ALLOWED_ORIGIN_REGEX: Optional[str] = None

    # Super Admin seed credentials (read from environment)
    SUPER_ADMIN_EMAIL: Optional[str] = None
    SUPER_ADMIN_PASSWORD: Optional[str] = None

    # App & Frontend URLs
    APP_URL: Optional[str] = None
    USER_APP_URL: Optional[str] = None
    ADMIN_APP_URL: Optional[str] = None
    TEMP_STORAGE_DIR: str = "./tmp_media"
    MAX_VIDEO_DURATION_SECONDS: int = 7200

    # Self-ping for keeping free-tier cloud instances awake (Render / etc.)
    SELF_PING_ENABLED: bool = True
    SELF_PING_URL: Optional[str] = None
    SELF_PING_INTERVAL_SECONDS: int = 600  # 10 minutes (Render sleeps after 15 min)
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
                    f"Cannot run in '{self.ENVIRONMENT}' mode with unset or insecure JWT_SECRET. "
                    "Please set a strong, unique JWT_SECRET in your environment variables."
                )
        else:
            if not self.JWT_SECRET:
                self.JWT_SECRET = "clipcraft-local-dev-fallback-key-32chars!"
        return self

settings = Settings()

