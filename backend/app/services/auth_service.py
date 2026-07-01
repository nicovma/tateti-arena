from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.repositories.user_repo import UserRepository
from app.models.models import User


async def verify_google_token(token: str) -> dict:
    idinfo = id_token.verify_oauth2_token(
        token,
        google_requests.Request(),
        settings.GOOGLE_CLIENT_ID,
    )
    return idinfo


async def upsert_user(db: AsyncSession, idinfo: dict) -> User:
    repo = UserRepository(db)
    user = await repo.get_by_email(idinfo["email"])
    if user is None:
        user = await repo.create(
            email=idinfo["email"],
            name=idinfo.get("name", ""),
            avatar_url=idinfo.get("picture"),
        )
    return user
