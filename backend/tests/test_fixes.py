import os
import io
import pytest
from starlette.requests import Request
from app.core.config import settings
from app.middleware.rate_limit import get_real_client_ip
from app.core.security import create_access_token, decode_access_token, get_password_hash, verify_password
from app.db.memory_store import memory_store
from app.providers.storage.cloudinary_provider import CloudinaryStorageProvider
from app.core.http_client import get_http_client
from httpx import AsyncClient, ASGITransport
from app.main import app

BASE = "http://test"
TRANSPORT = ASGITransport(app=app)

@pytest.mark.asyncio
async def test_get_real_client_ip_dev_vs_prod():
    # Helper to make dummy request
    def make_request(headers=None, client_host="192.168.1.50"):
        scope = {
            "type": "http",
            "method": "GET",
            "path": "/",
            "headers": [(k.lower().encode("latin1"), v.encode("latin1")) for k, v in (headers or {}).items()],
            "client": (client_host, 12345),
        }
        return Request(scope)

    # In development: spoofed x-forwarded-for should NOT be trusted
    settings.ENVIRONMENT = "development"
    req_spoofed = make_request(
        headers={"x-forwarded-for": "1.2.3.4, 5.6.7.8", "x-real-ip": "9.10.11.12"},
        client_host="127.0.0.1"
    )
    assert get_real_client_ip(req_spoofed) == "127.0.0.1"

    # In production: x-forwarded-for is trusted
    settings.ENVIRONMENT = "production"
    assert get_real_client_ip(req_spoofed) == "1.2.3.4"

    # In production with only x-real-ip
    req_real = make_request(headers={"x-real-ip": "9.10.11.12"}, client_host="10.0.0.1")
    assert get_real_client_ip(req_real) == "9.10.11.12"

    # Reset
    settings.ENVIRONMENT = "development"


def test_security_pyjwt_token_handling():
    # Passwords
    hashed = get_password_hash("MySecretPassword123!")
    assert verify_password("MySecretPassword123!", hashed) is True
    assert verify_password("WrongPassword!", hashed) is False

    # Tokens
    token = create_access_token(subject="user_12345", email="test@example.com", extra_claims={"role": "admin"})
    assert isinstance(token, str)
    decoded = decode_access_token(token)
    assert decoded is not None
    assert decoded["sub"] == "user_12345"
    assert decoded["email"] == "test@example.com"
    assert decoded["role"] == "admin"


@pytest.mark.asyncio
async def test_storage_cleanup_memory_store():
    from app.api.admin.storage import trigger_storage_cleanup
    from app.models.admin import AdminResponse, AdminRole, AdminStatus
    from datetime import datetime

    mock_admin = AdminResponse(
        id="admin_test_1",
        email="admin@clipcraft.io",
        name="Test Admin",
        role=AdminRole.SUPER_ADMIN,
        status=AdminStatus.ACTIVE,
        createdAt=datetime.utcnow(),
        updatedAt=datetime.utcnow()
    )

    # Add mock jobs and clips directly into memory_store
    memory_store.jobs["job_test_clean"] = {
        "id": "job_test_clean",
        "status": "completed",
        "userId": "user_test",
        "createdAt": datetime.utcnow()
    }
    memory_store.clips["clip_test_clean"] = {
        "id": "clip_test_clean",
        "jobId": "job_test_clean",
        "createdAt": datetime.utcnow()
    }

    # Execute storage cleanup for clips and db
    res = await trigger_storage_cleanup(category="clips", current_admin=mock_admin)
    assert "Deleted" in res["message"] or "already clean" in res["message"]
    assert "clip_test_clean" not in memory_store.clips

    res_db = await trigger_storage_cleanup(category="database", current_admin=mock_admin)
    assert "Pruned" in res_db["message"] or "already clean" in res_db["message"]
    assert "job_test_clean" not in memory_store.jobs


@pytest.mark.asyncio
async def test_admin_logs_no_synthetic_injection():
    from app.api.admin.logs import get_system_logs
    from app.models.admin import AdminResponse, AdminRole, AdminStatus
    from datetime import datetime

    mock_admin = AdminResponse(
        id="admin_test_1",
        email="admin@clipcraft.io",
        name="Test Admin",
        role=AdminRole.SUPER_ADMIN,
        status=AdminStatus.ACTIVE,
        createdAt=datetime.utcnow(),
        updatedAt=datetime.utcnow()
    )

    # Clear system logs in memory store
    memory_store.system_logs.clear()

    # Calling get_system_logs should NOT inject fake logs
    res = await get_system_logs(level=None, service=None, search=None, limit=100, current_admin=mock_admin)
    assert res["count"] == 0
    assert len(res["logs"]) == 0


@pytest.mark.asyncio
async def test_async_video_upload():
    # Register a user
    async with AsyncClient(transport=TRANSPORT, base_url=BASE) as client:
        reg_resp = await client.post("/api/auth/register", json={
            "email": "test_upload_async@example.com",
            "password": "Password123!"
        })
        assert reg_resp.status_code == 200
        token = reg_resp.json()["access_token"]

        # Fake small video bytes
        fake_video_bytes = b"fake mp4 video content header for testing async io upload stream"
        files = {
            "file": ("test_clip.mp4", io.BytesIO(fake_video_bytes), "video/mp4")
        }
        data = {
            "clipCount": 2,
            "minDuration": 15,
            "maxDuration": 30
        }

        resp = await client.post(
            "/api/jobs/upload",
            files=files,
            data=data,
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 201
        job_data = resp.json()
        assert job_data["sourceType"] == "upload"
        assert job_data["status"] == "queued"


@pytest.mark.asyncio
async def test_cloudinary_provider_local_fallback(tmp_path):
    # Test upload_video and upload_image using asyncio.to_thread
    provider = CloudinaryStorageProvider()
    provider.is_configured = False  # Ensure local mode

    sample_file = tmp_path / "test_video.mp4"
    sample_file.write_bytes(b"sample video bytes")

    res_video = await provider.upload_video(str(sample_file), force_local=True)
    assert res_video["format"] == "mp4"
    assert "/api/media/clips/" in res_video["secure_url"]

    sample_img = tmp_path / "test_thumb.jpg"
    sample_img.write_bytes(b"sample image bytes")

    res_img = await provider.upload_image(str(sample_img), force_local=True)
    assert "/api/media/thumbnails/" in res_img["secure_url"]


@pytest.mark.asyncio
async def test_http_client_singleton():
    c1 = await get_http_client()
    c2 = await get_http_client()
    assert c1 is c2
    assert not c1.is_closed
