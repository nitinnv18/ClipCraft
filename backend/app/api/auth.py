from fastapi import APIRouter, HTTPException, Depends, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.models.user import UserCreate, UserLogin, UserResponse, TokenResponse
from app.core.security import decode_access_token
from app.services.auth_service import auth_service
from app.core.logging import logger
from app.middleware.rate_limit import limiter, AUTH_LIMIT

router = APIRouter(prefix="/auth", tags=["Authentication"])
security = HTTPBearer(auto_error=False)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> UserResponse:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token required.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = credentials.credentials
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
    return user


@router.post("/register", response_model=TokenResponse)
@limiter.limit(AUTH_LIMIT)
async def register(req: UserCreate, request: Request):
    try:
        token, user_res, was_existing = await auth_service.register_user(req.email, req.password)
        if was_existing:
            logger.info(f"Duplicate registration resolved to seamless login for: {req.email}")
        else:
            logger.info(f"Registered new user: {req.email} ({user_res.id})")
        return TokenResponse(access_token=token, user=user_res)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/login", response_model=TokenResponse)
@limiter.limit(AUTH_LIMIT)
async def login(req: UserLogin, request: Request):
    auth_result = await auth_service.authenticate_user(req.email, req.password)
    if not auth_result:
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    
    token, user_res = auth_result
    logger.info(f"User logged in: {req.email}")
    return TokenResponse(access_token=token, user=user_res)


@router.get("/me", response_model=UserResponse)
async def get_profile(current_user: UserResponse = Depends(get_current_user)):
    return current_user
