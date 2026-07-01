import pytest
from app.repositories.game_repo import GameRepository
from app.repositories.user_repo import UserRepository
from app.models.models import GameStatus


@pytest.mark.asyncio
async def test_create_game_persists_to_db(db_session):
    user_repo = UserRepository(db_session)
    user = await user_repo.create(
        email="player@example.com",
        name="Player One",
        avatar_url=None,
    )

    game_repo = GameRepository(db_session)
    game = await game_repo.create(player_x_id=user.id)

    assert game.id is not None
    assert game.player_x_id == user.id
    assert game.status == GameStatus.in_progress
    assert game.board == " " * 9
