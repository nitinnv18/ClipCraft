from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Request, Response, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.config import settings
from app.models.user import UserCreate, UserLogin, UserResponse, TokenResponse
from app.core.security import decode_access_token
from app.services.auth_service import auth_service
from app.core.logging import logger
from app.middleware.rate_limit import limiter, AUTH_LIMIT

router = APIRouter(prefix="/auth", tags=["Authentication"])
security = HTTPBearer(auto_error=False)

async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> UserResponse:
    token = credentials.credentials if credentials else request.cookies.get("clipcraft_token")
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token required.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user_id = payload["sub"]
    user = await auth_service.get_user_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User session expired or account not found. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if getattr(user, "status", "active") == "suspended":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been suspended. Please contact support.",
        )
    return user


async def get_current_user_optional(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[UserResponse]:
    token = credentials.credentials if credentials else request.cookies.get("clipcraft_token")
    if not token:
        return None
    try:
        payload = decode_access_token(token)
        if not payload or "sub" not in payload:
            return None
        user_id = payload["sub"]
        user = await auth_service.get_user_by_id(user_id)
        if user and getattr(user, "status", "active") == "suspended":
            return None
        return user
    except Exception:
        return None


@router.post("/register", response_model=TokenResponse)
@limiter.limit(AUTH_LIMIT)
async def register(req: UserCreate, request: Request, response: Response):
    try:
        token, user_res, _ = await auth_service.register_user(req.email, req.password)
        logger.info(f"Registered new user: {req.email} ({user_res.id})")
        response.set_cookie(
            key="clipcraft_token",
            value=token,
            httponly=True,
            secure=settings.ENVIRONMENT == "production",
            samesite="lax",
            max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            path="/"
        )
        return TokenResponse(access_token=token, user=user_res)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/login", response_model=TokenResponse)
@limiter.limit(AUTH_LIMIT)
async def login(req: UserLogin, request: Request, response: Response):
    try:
        auth_result = await auth_service.authenticate_user(req.email, req.password)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(e))

    if not auth_result:
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    
    token, user_res = auth_result
    logger.info(f"User logged in: {req.email}")
    response.set_cookie(
        key="clipcraft_token",
        value=token,
        httponly=True,
        secure=settings.ENVIRONMENT == "production",
        samesite="lax",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/"
    )
    return TokenResponse(access_token=token, user=user_res)


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(key="clipcraft_token", path="/")
    return {"message": "Signed out successfully."}


@router.get("/me", response_model=UserResponse)
async def get_profile(current_user: UserResponse = Depends(get_current_user)):
    return current_user
