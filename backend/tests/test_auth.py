"""
Authentication endpoint tests.

Covers:
- Happy-path register and login
- Wrong-password rejection
- Protected route enforcement (no token → 401)
- Ghost Auth regression: a JWT for a non-existent user must NOT be accepted
"""
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.security import create_access_token

BASE = "http://test"
TRANSPORT = ASGITransport(app=app)


@pytest.mark.asyncio
async def test_register_returns_token():
    async with AsyncClient(transport=TRANSPORT, base_url=BASE) as client:
        resp = await client.post("/api/auth/register", json={
            "email": "test_register@example.com",
            "password": "SecurePass123!"
        })
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert "access_token" in body
    assert body["user"]["email"] == "test_register@example.com"


@pytest.mark.asyncio
async def test_login_success():
    """Register once, then login and confirm we get a fresh token."""
    async with AsyncClient(transport=TRANSPORT, base_url=BASE) as client:
        # Ensure the account exists
        await client.post("/api/auth/register", json={
            "email": "test_login@example.com",
            "password": "SecurePass123!"
        })
        resp = await client.post("/api/auth/login", json={
            "email": "test_login@example.com",
            "password": "SecurePass123!"
        })
    assert resp.status_code == 200, resp.text
    assert "access_token" in resp.json()


@pytest.mark.asyncio
async def test_login_wrong_password_returns_401():
    async with AsyncClient(transport=TRANSPORT, base_url=BASE) as client:
        await client.post("/api/auth/register", json={
            "email": "test_wrong_pw@example.com",
            "password": "CorrectPassword1!"
        })
        resp = await client.post("/api/auth/login", json={
            "email": "test_wrong_pw@example.com",
            "password": "WrongPassword!"
        })
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_protected_route_requires_token():
    """GET /api/jobs without Authorization header must return 401."""
    async with AsyncClient(transport=TRANSPORT, base_url=BASE) as client:
        resp = await client.get("/api/jobs")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_ghost_auth_removed():
    """
    Regression test for the Ghost Auth vulnerability (CVE-ClipCraft-001).

    A JWT whose ``sub`` claim refers to a user ID that does NOT exist in either
    MongoDB or the in-memory store must be REJECTED with 401.

    Previously the server would synthesise a user from the JWT claims alone,
    allowing arbitrary token holders to impersonate any user ID.
    """
    # Craft a structurally valid JWT for a user that has never been registered
    ghost_token = create_access_token(
        subject="ghost_user_does_not_exist_xyz",
        email="ghost@nowhere.io",
    )
    async with AsyncClient(transport=TRANSPORT, base_url=BASE) as client:
        resp = await client.get("/api/jobs", headers={"Authorization": f"Bearer {ghost_token}"})

    assert resp.status_code == 401, (
        f"Ghost Auth vulnerability still present! "
        f"Server returned {resp.status_code} instead of 401."
    )


@pytest.mark.asyncio
async def test_get_me_with_valid_token():
    """Authenticated /me should return the current user's profile."""
    async with AsyncClient(transport=TRANSPORT, base_url=BASE) as client:
        reg = await client.post("/api/auth/register", json={
            "email": "test_me@example.com",
            "password": "SecurePass123!"
        })
        token = reg.json()["access_token"]
        resp = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert resp.status_code == 200
    assert resp.json()["email"] == "test_me@example.com"
