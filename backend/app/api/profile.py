import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.jwt_utils import decode_access_token
from app.repositories.user_repo import UserRepository
from app.repositories.game_repo import GameRepository
from app.schemas.schemas import StatsResponse, MatchHistoryItem

router = APIRouter(prefix="/profile", tags=["profile"])
bearer = HTTPBearer()


async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> uuid.UUID:
    try:
        user_id = decode_access_token(credentials.credentials)
        return uuid.UUID(user_id)
    except (JWTError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


@router.get("/stats", response_model=StatsResponse)
async def get_stats(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    user_repo = UserRepository(db)
    game_repo = GameRepository(db)

    user = await user_repo.get_by_id(user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    games = await game_repo.get_history(user_id)

    history = []
    for game in games:
        opponent = game.player_o if game.player_x_id == user_id else game.player_x
        if game.winner_id is None:
            result = "DRAW"
        elif game.winner_id == user_id:
            result = "WIN"
        else:
            result = "LOSS"
        history.append(MatchHistoryItem(
            game_id=game.id,
            opponent=opponent.name if opponent else "Unknown",
            result=result,
            date=game.finished_at,
        ))

    return StatsResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        avatar_url=user.avatar_url,
        wins=user.wins,
        losses=user.losses,
        draws=user.draws,
        match_history=history,
    )
