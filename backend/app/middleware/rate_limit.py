"""Rate limiting middleware using slowapi (Starlette-compatible wrapper for limits).

Provides:
- Global default: 120 requests / minute per IP
- Auth endpoints: 10 requests / minute per IP (brute-force protection)
- Job creation: 20 requests / minute per IP
"""
from slowapi import Limiter  # type: ignore
from slowapi.util import get_remote_address  # type: ignore

# Global limiter instance — imported and registered in main.py
# headers_enabled=False: avoids the requirement for a `Response` param on every
# decorated endpoint. Rate limiting is still fully enforced; callers just won't
# see RateLimit-* headers in the response (acceptable trade-off for simplicity).
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["120/minute"],
    headers_enabled=False,
)

# Tighter limits exported for use as route-level decorators
AUTH_LIMIT = "10/minute"
JOB_CREATE_LIMIT = "20/minute"
ADMIN_AUTH_LIMIT = "10/minute"
