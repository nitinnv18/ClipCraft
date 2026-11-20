import asyncio
from datetime import timedelta
from typing import Optional, Union, Any, Dict
import bcrypt
import jwt

from app.core.config import settings
from app.core.utils import utc_now

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8")
        )
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")

async def verify_password_async(plain_password: str, hashed_password: str) -> bool:
    """Non-blocking asynchronous verification of password hashes using thread pool."""
    return await asyncio.to_thread(verify_password, plain_password, hashed_password)

async def get_password_hash_async(password: str) -> str:
    """Non-blocking asynchronous password hashing using thread pool."""
    return await asyncio.to_thread(get_password_hash, password)

def create_access_token(
    subject: Union[str, Any],
    email: Optional[str] = None,
    expires_delta: Optional[timedelta] = None,
    extra_claims: Optional[Dict[str, Any]] = None,
) -> str:
    """Create a signed JWT with expiration and issued-at timestamp."""
    now = utc_now()
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode: Dict[str, Any] = {"exp": expire, "iat": now, "sub": str(subject)}
    if email:
        to_encode["email"] = email
    if extra_claims:
        to_encode.update(extra_claims)

    token = jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return token if isinstance(token, str) else token.decode("utf-8")

def decode_access_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.PyJWTError:
        return None
    except Exception:
        return None

