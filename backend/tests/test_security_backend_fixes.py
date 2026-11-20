import os
import pytest
from starlette.requests import Request
from httpx import AsyncClient, ASGITransport
from app.core.config import Settings, settings
from app.middleware.rate_limit import get_real_client_ip
from app.core.security import create_access_token
from app.db.memory_store import memory_store
from app.main import app
from app.api.admin.storage import _scan_dir
from app.providers.video.ffmpeg_processor import FFmpegVideoProcessor
from app.queue.redis_queue import RedisQueueProvider
from app.api.admin.clips import delete_clip
from app.api.admin.users import delete_user
from datetime import datetime
from app.models.admin import AdminResponse, AdminRole, AdminStatus

BASE = "http://test"
TRANSPORT = ASGITransport(app=app)

# ── 1. Settings & Security Auth ───────────────────────────────────────────────
def test_production_jwt_secret_enforcement():
    # Outside development, default or weak keys must be rejected
    with pytest.raises(ValueError, match="CRITICAL SECURITY CONFIGURATION ERROR"):
        Settings(ENVIRONMENT="production")

    with pytest.raises(ValueError, match="CRITICAL SECURITY CONFIGURATION ERROR"):
        Settings(ENVIRONMENT="staging")

    with pytest.raises(ValueError, match="CRITICAL SECURITY CONFIGURATION ERROR"):
        Settings(ENVIRONMENT="production", JWT_SECRET="short")

    with pytest.raises(ValueError, match="CRITICAL SECURITY CONFIGURATION ERROR"):
        Settings(ENVIRONMENT="staging", JWT_SECRET="changeme")

    # In development, default key is allowed
    dev_settings = Settings(ENVIRONMENT="development")
    assert dev_settings.ENVIRONMENT == "development"

    # Outside development with strong key succeeds
    prod_settings = Settings(
        ENVIRONMENT="production",
        JWT_SECRET="super-strong-production-key-that-is-at-least-32-chars-long!"
    )
    assert prod_settings.ENVIRONMENT == "production"


# ── 2. Rate Limit Proxy Spoofing ─────────────────────────────────────────────
def test_rate_limit_trusted_proxies():
    def make_request(headers=None, client_host="192.168.1.50"):
        scope = {
            "type": "http",
            "method": "GET",
            "path": "/",
            "headers": [(k.lower().encode("latin1"), v.encode("latin1")) for k, v in (headers or {}).items()],
            "client": (client_host, 12345),
        }
        return Request(scope)

    settings.ENVIRONMENT = "production"
    try:
        # Untrusted external IP attempting to spoof X-Forwarded-For -> MUST IGNORE
        untrusted_req = make_request(
            headers={"x-forwarded-for": "1.2.3.4", "x-real-ip": "5.6.7.8"},
            client_host="203.0.113.195"
        )
        assert get_real_client_ip(untrusted_req) == "203.0.113.195"

        # Trusted internal proxies -> TRUST header
        for proxy_ip in ["127.0.0.1", "10.0.5.1", "172.16.2.3", "192.168.1.1"]:
            trusted_req = make_request(
                headers={"x-forwarded-for": "203.0.113.10, 10.0.0.1"},
                client_host=proxy_ip
            )
            assert get_real_client_ip(trusted_req) == "203.0.113.10"
    finally:
        settings.ENVIRONMENT = "development"


# ── 3. Media IDOR Protection ──────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_media_idor_protection():
    # Setup dummy media file in public_media/clips
    clips_dir = os.path.join(settings.TEMP_STORAGE_DIR, "public_media", "clips")
    os.makedirs(clips_dir, exist_ok=True)
    sample_file = os.path.join(clips_dir, "clip_idor_test.mp4")
    with open(sample_file, "wb") as f:
        f.write(b"\x00\x00\x00\x20ftypisom" + b"A" * 1024)

    # Register clip in memory_store owned by user_alice
    clip_id = "clip_idor_test"
    memory_store.add_clip(clip_id, {
        "id": clip_id,
        "_id": clip_id,
        "jobId": "job_idor_test",
        "userId": "user_alice",
        "videoUrl": f"/api/media/clips/{clip_id}.mp4",
        "thumbnailUrl": f"/api/media/thumbnails/{clip_id}.jpg"
    })
    memory_store.set_job("job_idor_test", {
        "id": "job_idor_test",
        "_id": "job_idor_test",
        "userId": "user_alice",
        "title": "Alice's Video"
    })

    token_alice = create_access_token(subject="user_alice", email="alice@test.com")
    token_bob = create_access_token(subject="user_bob", email="bob@test.com")
    token_admin = create_access_token(
        subject="admin_user",
        email="admin@test.com",
        extra_claims={"type": "admin", "role": "admin"}
    )

    async with AsyncClient(transport=TRANSPORT, base_url=BASE) as client:
        # 1. Unauthenticated request -> 401
        res_no_auth = await client.get("/api/media/clips/clip_idor_test.mp4")
        assert res_no_auth.status_code == 401

        # 2. Invalid token -> 401
        res_invalid = await client.get(
            "/api/media/clips/clip_idor_test.mp4",
            headers={"Authorization": "Bearer invalid_token_123"}
        )
        assert res_invalid.status_code == 401

        # 3. IDOR Attack: Bob tries to access Alice's clip -> 403 Forbidden
        res_bob = await client.get(
            "/api/media/clips/clip_idor_test.mp4",
            headers={"Authorization": f"Bearer {token_bob}"}
        )
        assert res_bob.status_code == 403

        # 4. Owner Alice accesses her clip via Bearer header -> 200
        res_alice = await client.get(
            "/api/media/clips/clip_idor_test.mp4",
            headers={"Authorization": f"Bearer {token_alice}"}
        )
        assert res_alice.status_code == 200

        # 5. Owner Alice accesses via ?token= query param -> 200
        res_alice_query = await client.get(
            f"/api/media/clips/clip_idor_test.mp4?token={token_alice}"
        )
        assert res_alice_query.status_code == 200

        # 6. Admin accesses Alice's clip -> 200
        res_admin = await client.get(
            "/api/media/clips/clip_idor_test.mp4",
            headers={"Authorization": f"Bearer {token_admin}"}
        )
        assert res_admin.status_code == 200


# ── 4. Concurrency: Storage Directory Scan & Subtitle Writing ────────────────
@pytest.mark.asyncio
async def test_concurrency_storage_scan_and_subtitles(tmp_path):
    # Test _scan_dir helper
    test_sub = tmp_path / "sub"
    test_sub.mkdir()
    (test_sub / "file1.txt").write_bytes(b"hello world")
    (test_sub / "file2.txt").write_bytes(b"1234567890")

    total_bytes, total_files = _scan_dir(str(tmp_path))
    assert total_files == 2
    assert total_bytes == len(b"hello world") + len(b"1234567890")

    # Test FFmpeg subtitles writing non-blocking
    processor = FFmpegVideoProcessor()
    srt_out = str(tmp_path / "test.srt")
    segments = [
        {"start": 1.0, "end": 4.0, "text": "Welcome to ClipCraft"},
        {"start": 4.5, "end": 8.0, "text": "AI Video Highlights"}
    ]
    await processor._create_subtitles_file(segments, 0.0, 10.0, srt_out)
    assert os.path.isfile(srt_out)
    with open(srt_out, "r", encoding="utf-8") as f:
        content = f.read()
    assert "WELCOME TO CLIPCRAFT" in content
    assert "AI VIDEO HIGHLIGHTS" in content


# ── 5. Reliable Processing Queue & Ack ────────────────────────────────────────
@pytest.mark.asyncio
async def test_queue_reliable_processing_and_ack():
    queue = RedisQueueProvider()
    await queue.enqueue_job("job_queue_test_1", {"clipCount": 3})

    # Dequeue next job
    job = await queue.get_next_job(timeout_seconds=1)
    assert job is not None
    assert job["job_id"] == "job_queue_test_1"
    assert "job_queue_test_1" in queue._memory_processing

    # Ack job removes from processing
    ack_res = await queue.ack_job("job_queue_test_1")
    assert ack_res is True
    assert "job_queue_test_1" not in queue._memory_processing


# ── 6. Asset Garbage Collection on Delete ─────────────────────────────────────
@pytest.mark.asyncio
async def test_asset_garbage_collection_on_delete(tmp_path):
    now = datetime.utcnow()
    admin = AdminResponse(
        id="admin_1",
        email="admin@clipcraft.io",
        role=AdminRole.SUPER_ADMIN,
        status=AdminStatus.ACTIVE,
        createdAt=now,
        updatedAt=now
    )
    temp_dir = settings.TEMP_STORAGE_DIR
    clips_dir = os.path.join(temp_dir, "public_media", "clips")
    thumbs_dir = os.path.join(temp_dir, "public_media", "thumbnails")
    os.makedirs(clips_dir, exist_ok=True)
    os.makedirs(thumbs_dir, exist_ok=True)

    # 1. Test clip deletion cleans up local files
    c_file = os.path.join(clips_dir, "clip_del_test.mp4")
    t_file = os.path.join(thumbs_dir, "clip_del_test.jpg")
    with open(c_file, "w") as f:
        f.write("video")
    with open(t_file, "w") as f:
        f.write("thumb")

    memory_store.add_clip("clip_del_test", {
        "id": "clip_del_test",
        "_id": "clip_del_test",
        "title": "Clip To Delete",
        "videoUrl": "/api/media/clips/clip_del_test.mp4",
        "thumbnailUrl": "/api/media/thumbnails/clip_del_test.jpg"
    })

    await delete_clip("clip_del_test", current_admin=admin)
    assert not os.path.exists(c_file)
    assert not os.path.exists(t_file)
    assert memory_store.get_clip("clip_del_test") is None

    # 2. Test user deletion cleans up user's clips and jobs
    u_clip_file = os.path.join(clips_dir, "clip_user_del.mp4")
    u_thumb_file = os.path.join(thumbs_dir, "clip_user_del.jpg")
    with open(u_clip_file, "w") as f:
        f.write("video")
    with open(u_thumb_file, "w") as f:
        f.write("thumb")

    memory_store.set_user("user_to_delete", {"id": "user_to_delete", "email": "del@test.com"})
    memory_store.add_clip("clip_user_del", {
        "id": "clip_user_del",
        "_id": "clip_user_del",
        "userId": "user_to_delete",
        "videoUrl": "/api/media/clips/clip_user_del.mp4",
        "thumbnailUrl": "/api/media/thumbnails/clip_user_del.jpg"
    })

    await delete_user("user_to_delete", current_admin=admin)
    assert not os.path.exists(u_clip_file)
    assert not os.path.exists(u_thumb_file)
    assert memory_store.get_user_by_id("user_to_delete") is None
    assert memory_store.get_clip("clip_user_del") is None
