from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.jwt_utils import create_access_token
from app.schemas.schemas import GoogleAuthRequest, AuthResponse, UserResponse
from app.services.auth_service import verify_google_token, upsert_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/google", response_model=AuthResponse)
async def google_login(body: GoogleAuthRequest, db: AsyncSession = Depends(get_db)):
    try:
        idinfo = await verify_google_token(body.token)
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Google token")

    user = await upsert_user(db, idinfo)
    token = create_access_token(str(user.id))

    return AuthResponse(
        jwt=token,
        user=UserResponse.model_validate(user),
    )
