from dataclasses import dataclass, field

WINNING_COMBINATIONS = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
]


def check_winner(board: list[str]) -> str | None:
    """Returns 'X', 'O', 'draw', or None if game is still in progress."""
    for a, b, c in WINNING_COMBINATIONS:
        if board[a] != " " and board[a] == board[b] == board[c]:
            return board[a]
    if " " not in board:
        return "draw"
    return None


@dataclass
class PlayerState:
    sid: str
    user_id: str
    name: str
    symbol: str


@dataclass
class GameState:
    game_id: str
    board: list[str] = field(default_factory=lambda: [" "] * 9)
    current_turn: str = "X"
    player_x: PlayerState | None = None
    player_o: PlayerState | None = None

    def get_player_by_sid(self, sid: str) -> PlayerState | None:
        if self.player_x and self.player_x.sid == sid:
            return self.player_x
        if self.player_o and self.player_o.sid == sid:
            return self.player_o
        return None

    def get_player_by_user_id(self, user_id: str) -> PlayerState | None:
        if self.player_x and self.player_x.user_id == user_id:
            return self.player_x
        if self.player_o and self.player_o.user_id == user_id:
            return self.player_o
        return None


# In-memory state shared across all event handlers

active_games: dict[str, GameState] = {}
waiting_player: dict | None = None
