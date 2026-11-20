from typing import Optional
import httpx

_client: Optional[httpx.AsyncClient] = None

async def get_http_client() -> httpx.AsyncClient:
    """Return a shared pooled httpx.AsyncClient with persistent keep-alive."""
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(
            timeout=httpx.Timeout(60.0, connect=10.0),
            limits=httpx.Limits(max_keepalive_connections=50, max_connections=200),
            follow_redirects=True
        )
    return _client

async def close_http_client():
    """Close shared HTTP client connection pool on app shutdown."""
    global _client
    if _client is not None and not _client.is_closed:
        await _client.aclose()
        _client = None
