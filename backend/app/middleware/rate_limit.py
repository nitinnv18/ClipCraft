"""Rate limiting middleware using slowapi (Starlette-compatible wrapper for limits).

Provides:
- Global default: 120 requests / minute per IP
- Auth endpoints: 10 requests / minute per IP (brute-force protection)
- Job creation: 20 requests / minute per IP
"""
import ipaddress
from fastapi import Request
from slowapi import Limiter  # type: ignore
from app.core.config import settings

TRUSTED_PROXIES = [
    ipaddress.ip_network("127.0.0.1/32"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
]

def _is_trusted_proxy(ip_str: str) -> bool:
    try:
        ip = ipaddress.ip_address(ip_str)
        return any(ip in net for net in TRUSTED_PROXIES)
    except Exception:
        return False

def get_real_client_ip(request: Request) -> str:
    client_host = request.client.host if request.client else "127.0.0.1"
    if settings.ENVIRONMENT == "production":
        if _is_trusted_proxy(client_host):
            forwarded = request.headers.get("x-forwarded-for")
            if forwarded:
                parts = [p.strip() for p in forwarded.split(",") if p.strip()]
                if parts:
                    return parts[0]
            real_ip = request.headers.get("x-real-ip")
            if real_ip:
                return real_ip.strip()
    return client_host

# Global limiter instance — imported and registered in main.py
limiter = Limiter(
    key_func=get_real_client_ip,
    default_limits=["120/minute"],
    headers_enabled=False,
    storage_uri=settings.REDIS_URL if settings.REDIS_URL else "memory://",
    swallow_errors=True,
    in_memory_fallback_enabled=True,
    in_memory_fallback=["120/minute"],
)

# Tighter limits exported for use as route-level decorators
AUTH_LIMIT = "10/minute"
JOB_CREATE_LIMIT = "20/minute"
CLIENT_SYNC_LIMIT = "120/minute"
ADMIN_AUTH_LIMIT = "10/minute"
