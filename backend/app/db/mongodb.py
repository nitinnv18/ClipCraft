import re
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.core.config import settings
from app.core.logging import logger

class Database:
    client: Optional[AsyncIOMotorClient] = None
    db: Optional[AsyncIOMotorDatabase] = None
    is_connected: bool = False

db_instance = Database()

async def connect_to_mongo():
    if not settings.MONGODB_URI:
        if settings.ENVIRONMENT.lower() == "development":
            mongo_uri = "mongodb://localhost:27017"
        else:
            logger.warning("MONGODB_URI not configured in environment. Utilizing in-memory data store fallback.")
            db_instance.is_connected = False
            return
    else:
        mongo_uri = settings.MONGODB_URI

    masked_uri = re.sub(r":([^/@]+)@", r":****@", mongo_uri)
    logger.debug(f"Connecting to MongoDB at {masked_uri}...")
    try:
        db_instance.client = AsyncIOMotorClient(
            mongo_uri,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=10000,
            socketTimeoutMS=45000,
            maxPoolSize=50,
            minPoolSize=0,
            maxIdleTimeMS=45000,
            waitQueueTimeoutMS=5000,
            retryWrites=True,
            retryReads=True
        )
        # Quick ping check before assigning db
        await db_instance.client.admin.command('ping')
        db_instance.db = db_instance.client[settings.MONGODB_DB_NAME]
        db_instance.is_connected = True
        logger.info(f"🍃 Connected to MongoDB cluster database: {settings.MONGODB_DB_NAME}")
        
        # Ensure indexes for high-throughput query performance
        await db_instance.db.users.create_index("email", unique=True)
        await db_instance.db.users.create_index("createdAt")
        await db_instance.db.jobs.create_index("userId")
        await db_instance.db.jobs.create_index("status")
        await db_instance.db.jobs.create_index("createdAt")
        await db_instance.db.jobs.create_index([("userId", 1), ("createdAt", -1)])
        await db_instance.db.jobs.create_index([("status", 1), ("createdAt", -1)])
        await db_instance.db.clips.create_index("jobId")
        await db_instance.db.clips.create_index("userId")
        await db_instance.db.clips.create_index("createdAt")
        await db_instance.db.clips.create_index([("score", -1), ("createdAt", -1)])
        await db_instance.db.clips.create_index([("jobId", 1), ("score", -1)])
        await db_instance.db.clips.create_index([("userId", 1), ("createdAt", -1)])
        await db_instance.db.admins.create_index("email", unique=True)
        await db_instance.db.audit_logs.create_index("createdAt")
        await db_instance.db.audit_logs.create_index("adminId")
    except Exception as e:
        logger.warning(f"MongoDB connection notice: {e}. Operating in resilient mode.")
        db_instance.is_connected = False
        db_instance.db = None

async def close_mongo_connection():
    logger.info("Closing MongoDB connection...")
    if db_instance.client:
        db_instance.client.close()
        db_instance.is_connected = False
        db_instance.db = None
        logger.info("MongoDB connection closed.")

def get_database() -> Optional[AsyncIOMotorDatabase]:
    if db_instance.is_connected:
        return db_instance.db
    return None
