import json
import asyncio
from typing import Dict, Any, Optional
import redis.asyncio as aioredis
from app.core.config import settings
from app.core.logging import logger
from app.providers.base import BaseQueueProvider

QUEUE_NAME = "clipcraft_video_jobs"

class RedisQueueProvider(BaseQueueProvider):
    def __init__(self):
        self.redis: Optional[aioredis.Redis] = None
        self.is_connected = False
        self._memory_queue: asyncio.Queue = asyncio.Queue()

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
                res = await self.redis.brpop(QUEUE_NAME, timeout=timeout_seconds)
                if res:
                    _, data = res
                    return json.loads(data)
            except Exception as e:
                logger.warning(f"Redis pop error: {e}")

        try:
            item = await asyncio.wait_for(self._memory_queue.get(), timeout=timeout_seconds)
            return item
        except asyncio.TimeoutError:
            return None

queue_instance = RedisQueueProvider()
