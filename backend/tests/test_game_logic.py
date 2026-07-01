from app.services.game_service import check_winner


def test_check_winner_detects_row_win():
    board = ["X", "X", "X", " ", " ", " ", " ", " ", " "]
    assert check_winner(board) == "X"


def test_check_winner_detects_column_win():
    board = ["O", " ", " ", "O", " ", " ", "O", " ", " "]
    assert check_winner(board) == "O"


def test_check_winner_detects_diagonal_win():
    board = ["X", " ", " ", " ", "X", " ", " ", " ", "X"]
    assert check_winner(board) == "X"


def test_check_winner_detects_draw():
    board = ["X", "O", "X", "X", "O", "O", "O", "X", "X"]
    assert check_winner(board) == "draw"


def test_check_winner_returns_none_when_in_progress():
    board = ["X", " ", " ", " ", " ", " ", " ", " ", " "]
    assert check_winner(board) is None
