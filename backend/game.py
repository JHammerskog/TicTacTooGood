Cell = str | None
Board = tuple[Cell, ...]

WINNING_LINES: tuple[tuple[int, int, int], ...] = (
    (0, 1, 2),
    (3, 4, 5),
    (6, 7, 8),
    (0, 3, 6),
    (1, 4, 7),
    (2, 5, 8),
    (0, 4, 8),
    (2, 4, 6),
)


def winner(board: Board) -> tuple[str, tuple[int, int, int]] | None:
    """Find the winner of a board, if there is one.

    Args:
        board: Nine cells, left-to-right then top-to-bottom.

    Returns:
        The winning mark and the three indices that won, or None if nobody
        has won. The line is returned because callers need to draw or report
        it.
    """
    for line in WINNING_LINES:
        a, b, c = line
        if board[a] is not None and board[a] == board[b] == board[c]:
            return board[a], line
    return None


def status(board: Board) -> tuple[str, str | None, tuple[int, int, int] | None]:
    """Summarise how a board stands.

    Args:
        board: Nine cells.

    Returns:
        A tuple of (status, winning mark, winning line), where status is
        "won", "drawn" or "in_progress". The mark and line are None unless
        somebody has won.
    """
    won = winner(board)
    if won is not None:
        return "won", won[0], won[1]
    if not legal_moves(board):
        return "drawn", None, None
    return "in_progress", None, None


def winning_marks(board: Board) -> set[str]:
    """Find every mark holding a completed line.

    A legal board has at most one. More than one means the position is
    unreachable, which is what the request validator uses this for.

    Args:
        board: Nine cells.

    Returns:
        The set of marks with three in a row; empty if nobody has won.
    """
    return {
        board[a]
        for a, b, c in WINNING_LINES
        if board[a] is not None and board[a] == board[b] == board[c]
    }


def legal_moves(board: Board) -> tuple[int, ...]:
    """List the indices that can still be played.

    Args:
        board: Nine cells.

    Returns:
        The empty cells' indices, in ascending order.
    """
    return tuple(index for index, cell in enumerate(board) if cell is None)


def player_to_move(board: Board) -> str:
    """Determine whose turn it is.

    Args:
        board: Nine cells.

    Returns:
        "X" or "O". X moves first, so an even number of marks means X.
    """
    played = sum(1 for cell in board if cell is not None)
    return "X" if played % 2 == 0 else "O"


def opponent(mark: str) -> str:
    """Return the other player's mark.

    Args:
        mark: "X" or "O".

    Returns:
        The opposing mark.
    """
    return "O" if mark == "X" else "X"


def place(board: Board, index: int, mark: str) -> Board:
    """Put a specific mark at a specific index.

    Used for hypothetical questions ("what if the opponent played here?"),
    which is why the mark is a parameter rather than derived from the board.

    Args:
        board: Nine cells.
        index: Where to place the mark.
        mark: "X" or "O".

    Returns:
        A new board; the original is not modified.
    """
    return board[:index] + (mark,) + board[index + 1 :]


def play(board: Board, index: int) -> Board:
    """Play the move the current player would make at an index.

    Args:
        board: Nine cells.
        index: Where to play.

    Returns:
        A new board with the player-to-move's mark added.
    """
    return place(board, index, player_to_move(board))
