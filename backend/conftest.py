import sys
import os
from unittest.mock import AsyncMock, patch
import pytest

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.middleware.rate_limit import limiter

@pytest.fixture(autouse=True)
def disable_rate_limiter():
    limiter.enabled = False
    yield
    limiter.enabled = True

@pytest.fixture(autouse=True)
def mock_video_worker():
    with patch("app.workers.video_worker.worker_instance.process_job", new_callable=AsyncMock) as mock_process:
        yield mock_process


