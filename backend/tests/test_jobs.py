"""
Job CRUD and security tests.

Covers:
- Unauthenticated job creation → 401
- Invalid YouTube URL → 400
- Authenticated job creation → 201
- Job list only returns own jobs
- IDOR: User A cannot delete User B's job
"""
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

BASE = "http://test"
TRANSPORT = ASGITransport(app=app)

VALID_YT_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
INVALID_URL = "https://notyoutube.com/watch?v=abc"


# ── Helpers ───────────────────────────────────────────────────────────────────
async def _register_and_token(client: AsyncClient, email: str, password: str = "SecurePass123!") -> str:
    resp = await client.post("/api/auth/register", json={"email": email, "password": password})
    assert resp.status_code == 200, f"Registration failed: {resp.text}"
    return resp.json()["access_token"]


# ── Tests ─────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_create_job_unauthenticated_returns_401():
    async with AsyncClient(transport=TRANSPORT, base_url=BASE) as client:
        resp = await client.post("/api/jobs", json={"youtubeUrl": VALID_YT_URL})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_create_job_invalid_youtube_url_returns_400():
    async with AsyncClient(transport=TRANSPORT, base_url=BASE) as client:
        token = await _register_and_token(client, "test_jobs_badurl@example.com")
        resp = await client.post(
            "/api/jobs",
            json={"youtubeUrl": INVALID_URL},
            headers={"Authorization": f"Bearer {token}"},
        )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_create_job_authenticated_returns_201():
    async with AsyncClient(transport=TRANSPORT, base_url=BASE) as client:
        token = await _register_and_token(client, "test_jobs_create@example.com")
        resp = await client.post(
            "/api/jobs",
            json={"youtubeUrl": VALID_YT_URL, "clipCount": 3},
            headers={"Authorization": f"Bearer {token}"},
        )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert "id" in body
    assert body["status"] == "queued"


@pytest.mark.asyncio
async def test_list_jobs_returns_only_own_jobs():
    """User A's job list must NOT contain User B's jobs."""
    async with AsyncClient(transport=TRANSPORT, base_url=BASE) as client:
        token_a = await _register_and_token(client, "test_jobs_isolation_a@example.com")
        token_b = await _register_and_token(client, "test_jobs_isolation_b@example.com")

        # Create a job as User B
        await client.post(
            "/api/jobs",
            json={"youtubeUrl": VALID_YT_URL, "clipCount": 2},
            headers={"Authorization": f"Bearer {token_b}"},
        )

        # List jobs as User A — should be empty (or only A's own jobs)
        resp = await client.get("/api/jobs", headers={"Authorization": f"Bearer {token_a}"})

    assert resp.status_code == 200
    jobs_a = resp.json()
    # All returned jobs must belong to User A — none should have User B's userId
    for j in jobs_a:
        assert "test_jobs_isolation_b" not in j.get("userId", "")


@pytest.mark.asyncio
async def test_delete_job_idor_prevented():
    """
    IDOR regression test: User A must NOT be able to delete User B's job.

    The endpoint should return 404 (ownership-check fail) rather than
    silently deleting the resource.
    """
    async with AsyncClient(transport=TRANSPORT, base_url=BASE) as client:
        token_a = await _register_and_token(client, "test_idor_a@example.com")
        token_b = await _register_and_token(client, "test_idor_b@example.com")

        # User B creates a job
        create_resp = await client.post(
            "/api/jobs",
            json={"youtubeUrl": VALID_YT_URL, "clipCount": 2},
            headers={"Authorization": f"Bearer {token_b}"},
        )
        assert create_resp.status_code == 201
        job_id = create_resp.json()["id"]

        # User A tries to delete User B's job → must be rejected
        del_resp = await client.delete(
            f"/api/jobs/{job_id}",
            headers={"Authorization": f"Bearer {token_a}"},
        )

    assert del_resp.status_code in (403, 404), (
        f"IDOR vulnerability present! User A deleted User B's job "
        f"(status={del_resp.status_code})"
    )


@pytest.mark.asyncio
async def test_get_job_detail_authenticated():
    """Authenticated owner should be able to retrieve their job by ID."""
    async with AsyncClient(transport=TRANSPORT, base_url=BASE) as client:
        token = await _register_and_token(client, "test_jobs_detail@example.com")
        create_resp = await client.post(
            "/api/jobs",
            json={"youtubeUrl": VALID_YT_URL, "clipCount": 2},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert create_resp.status_code == 201
        job_id = create_resp.json()["id"]

        detail_resp = await client.get(
            f"/api/jobs/{job_id}",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert detail_resp.status_code == 200
    assert detail_resp.json()["id"] == job_id
