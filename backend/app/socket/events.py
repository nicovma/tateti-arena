import uuid
from jose import JWTError

from app.main import sio
from app.core.jwt_utils import decode_access_token
from app.core.database import async_session_maker
from app.repositories.user_repo import UserRepository
from app.repositories.game_repo import GameRepository
from app.services.game_service import (
    GameState, PlayerState, check_winner,
    active_games,
)
import app.services.game_service as game_svc


@sio.event
async def connect(sid, environ, auth):
    token = (auth or {}).get("token")
    if not token:
        raise ConnectionRefusedError("Authentication required")
    try:
        user_id = decode_access_token(token)
        async with async_session_maker() as db:
            user = await UserRepository(db).get_by_id(uuid.UUID(user_id))
        if user is None:
            raise ConnectionRefusedError("User not found")
        await sio.save_session(sid, {"user_id": user_id, "name": user.name})
    except (JWTError, ValueError):
        raise ConnectionRefusedError("Invalid token")


@sio.event
async def disconnect(sid):
    session = await sio.get_session(sid)
    if not session:
        return
    if game_svc.waiting_player and game_svc.waiting_player["sid"] == sid:
        game_svc.waiting_player = None
    for game_id, game in list(active_games.items()):
        if game.get_player_by_sid(sid):
            await sio.emit("opponent_disconnected", {}, room=game_id, skip_sid=sid)
            break


@sio.event
async def find_match(sid, data):
    session = await sio.get_session(sid)
    user_id = session["user_id"]
    name = session["name"]

    if game_svc.waiting_player is None:
        game_svc.waiting_player = {"sid": sid, "user_id": user_id, "name": name}
        await sio.emit("waiting", {}, to=sid)
        return

    opponent = game_svc.waiting_player
    game_svc.waiting_player = None

    async with async_session_maker() as db:
        game_repo = GameRepository(db)
        db_game = await game_repo.create(uuid.UUID(opponent["user_id"]))
        await game_repo.add_player_o(db_game.id, uuid.UUID(user_id))
        game_id = str(db_game.id)

    player_x = PlayerState(sid=opponent["sid"], user_id=opponent["user_id"], name=opponent["name"], symbol="X")
    player_o = PlayerState(sid=sid, user_id=user_id, name=name, symbol="O")
    active_games[game_id] = GameState(game_id=game_id, player_x=player_x, player_o=player_o)

    await sio.enter_room(opponent["sid"], game_id)
    await sio.enter_room(sid, game_id)

    await sio.emit("game_start", {"game_id": game_id, "symbol": "X", "opponent": name}, to=opponent["sid"])
    await sio.emit("game_start", {"game_id": game_id, "symbol": "O", "opponent": opponent["name"]}, to=sid)


@sio.event
async def make_move(sid, data):
    game_id = data.get("game_id")
    position = data.get("position")

    game = active_games.get(game_id)
    if game is None:
        return

    player = game.get_player_by_sid(sid)
    if player is None or player.symbol != game.current_turn:
        return

    if not (0 <= position <= 8) or game.board[position] != " ":
        return

    game.board[position] = player.symbol
    game.current_turn = "O" if game.current_turn == "X" else "X"
    board_str = "".join(game.board)
    result = check_winner(game.board)

    if result is None:
        await sio.emit("board_update", {"board": board_str, "next_turn": game.current_turn}, room=game_id)
        return

    winner_id = None
    loser_id = None

    if result != "draw":
        winner = game.player_x if result == "X" else game.player_o
        loser = game.player_o if result == "X" else game.player_x
        winner_id = uuid.UUID(winner.user_id)
        loser_id = uuid.UUID(loser.user_id)

    async with async_session_maker() as db:
        game_repo = GameRepository(db)
        user_repo = UserRepository(db)
        await game_repo.finish(uuid.UUID(game_id), winner_id, board_str)
        if result == "draw":
            await user_repo.increment_draw(uuid.UUID(game.player_x.user_id))
            await user_repo.increment_draw(uuid.UUID(game.player_o.user_id))
        else:
            await user_repo.increment_winner(winner_id)
            await user_repo.increment_loser(loser_id)
        await db.commit()

    await sio.emit("game_over", {"winner_id": str(winner_id) if winner_id else None, "board": board_str}, room=game_id)
    del active_games[game_id]
