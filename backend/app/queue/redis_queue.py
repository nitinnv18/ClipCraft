import json
import asyncio
from typing import Dict, Any, Optional
import redis.asyncio as aioredis
from app.core.config import settings
from app.core.logging import logger
from app.providers.base import BaseQueueProvider

QUEUE_NAME = "clipcraft_video_jobs"
PROCESSING_QUEUE_NAME = "clipcraft:jobs:processing"

class RedisQueueProvider(BaseQueueProvider):
    def __init__(self):
        self.redis: Optional[aioredis.Redis] = None
        self.is_connected = False
        self._memory_queue: asyncio.Queue = asyncio.Queue()
        self._memory_processing: Dict[str, Any] = {}

    async def initialize(self):
        try:
            self.redis = aioredis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_timeout=2.0
            )
            await self.redis.ping()
            self.is_connected = True
            logger.info("Connected to Redis queue service.")
        except Exception as e:
            logger.warning(f"Redis connection notice: {e}. Utilizing asynchronous in-process queue.")
            self.is_connected = False

    async def enqueue_job(self, job_id: str, payload: Dict[str, Any]) -> bool:
        message = json.dumps({"job_id": job_id, "payload": payload})
        if self.is_connected and self.redis:
            try:
                await self.redis.lpush(QUEUE_NAME, message)
                logger.info(f"Job {job_id} pushed to Redis queue.")
                return True
            except Exception as e:
                logger.error(f"Redis enqueue error: {e}. Falling back to internal queue.")
        
        await self._memory_queue.put({"job_id": job_id, "payload": payload})
        logger.info(f"Job {job_id} queued in memory.")
        return True

    async def get_next_job(self, timeout_seconds: int = 2) -> Optional[Dict[str, Any]]:
        if self.is_connected and self.redis:
            try:
                # Reliable queue pattern: atomic move from main queue to processing queue
                data = await self.redis.brpoplpush(QUEUE_NAME, PROCESSING_QUEUE_NAME, timeout=timeout_seconds)
                if data:
                    item = json.loads(data)
                    logger.info(f"Job {item.get('job_id')} moved to processing queue.")
                    return item
            except Exception as e:
                logger.warning(f"Redis reliable pop error: {e}")

        try:
            item = await asyncio.wait_for(self._memory_queue.get(), timeout=timeout_seconds)
            if item and "job_id" in item:
                self._memory_processing[item["job_id"]] = item
            return item
        except asyncio.TimeoutError:
            return None

    async def ack_job(self, job_id: str, payload: Optional[Dict[str, Any]] = None) -> bool:
        """Acknowledge completion of a job and remove it from the processing queue."""
        if self.is_connected and self.redis:
            try:
                removed = 0
                if payload is not None:
                    exact_msg = json.dumps({"job_id": job_id, "payload": payload})
                    removed = await self.redis.lrem(PROCESSING_QUEUE_NAME, 0, exact_msg)

                if not removed:
                    items = await self.redis.lrange(PROCESSING_QUEUE_NAME, 0, -1)
                    for item in items:
                        try:
                            parsed = json.loads(item)
                            if parsed.get("job_id") == job_id:
                                await self.redis.lrem(PROCESSING_QUEUE_NAME, 0, item)
                                removed += 1
                        except Exception:
                            pass
                logger.info(f"Job {job_id} acknowledged and removed from processing queue ({removed} instances).")
                return True
            except Exception as e:
                logger.error(f"Redis ack_job error for {job_id}: {e}")
                return False

        self._memory_processing.pop(job_id, None)
        return True

    async def close(self):
        if self.redis:
            try:
                await self.redis.aclose()
            except Exception:
                try:
                    await self.redis.close()
                except Exception:
                    pass
            self.is_connected = False

queue_instance = RedisQueueProvider()
