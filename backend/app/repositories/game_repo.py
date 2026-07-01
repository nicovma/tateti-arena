import uuid
from datetime import datetime, timezone
from sqlalchemy import select, or_, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.models import Game, GameStatus, User


class GameRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, player_x_id: uuid.UUID) -> Game:
        game = Game(player_x_id=player_x_id, status=GameStatus.in_progress)
        self.session.add(game)
        await self.session.commit()
        await self.session.refresh(game)
        return game

    async def add_player_o(self, game_id: uuid.UUID, player_o_id: uuid.UUID) -> None:
        await self.session.execute(
            update(Game)
            .where(Game.id == game_id)
            .values(player_o_id=player_o_id)
        )
        await self.session.commit()

    async def finish(
        self,
        game_id: uuid.UUID,
        winner_id: uuid.UUID | None,
        board: str,
    ) -> None:
        await self.session.execute(
            update(Game)
            .where(Game.id == game_id)
            .values(
                winner_id=winner_id,
                status=GameStatus.finished,
                board=board,
                finished_at=datetime.now(timezone.utc),
            )
        )
        # No commit here — caller commits all changes in a single transaction
        # Atomic

    async def get_history(self, user_id: uuid.UUID, limit: int = 20) -> list[Game]:
        result = await self.session.execute(
            select(Game)
            .options(selectinload(Game.player_x), selectinload(Game.player_o))
            .where(
                or_(Game.player_x_id == user_id, Game.player_o_id == user_id),
                Game.status == GameStatus.finished,
            )
            .order_by(Game.finished_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())
