from game import Board, legal_moves, opponent, place, player_to_move, winner

CENTRE = 4
CORNERS: tuple[int, ...] = (0, 2, 6, 8)
OPPOSITE_CORNERS: dict[int, int] = {0: 8, 8: 0, 2: 6, 6: 2}


def _completes_a_line(board: Board, index: int, mark: str) -> bool:
    """Test whether placing a mark at an index completes three in a row.

    Args:
        board: Nine cells.
        index: The cell to test.
        mark: The mark to hypothetically place.

    Returns:
        True if that placement wins for that mark.
    """
    won = winner(place(board, index, mark))
    return won is not None and won[0] == mark


def _immediate_wins(board: Board, mark: str) -> int:
    """Count the cells where a mark could win on the very next placement.

    Args:
        board: Nine cells.
        mark: The mark to count threats for.

    Returns:
        How many distinct winning placements exist.
    """
    return sum(1 for index in legal_moves(board) if _completes_a_line(board, index, mark))


def _can_fork(board: Board, mark: str) -> bool:
    """Test whether a mark could create a fork on its next placement.

    Args:
        board: Nine cells.
        mark: The mark to test.

    Returns:
        True if some legal move would give that mark two immediate winning
        replies at once.
    """
    return any(
        _immediate_wins(place(board, index, mark), mark) >= 2 for index in legal_moves(board)
    )


def name_move(board: Board, index: int) -> str:
    """Name the pattern a move represents.

    Rules are checked in priority order and the first match wins, so a move
    that both wins and blocks is reported as a win. The name describes what
    the move *is*; whether it is actually good is the solver's question, and
    the two can legitimately disagree.

    Args:
        board: Nine cells, with the game still in progress.
        index: The legal move to name.

    Returns:
        One of "win", "block", "fork", "block_fork", "centre",
        "opposite_corner", "empty_corner" or "empty_side".
    """
    mover = player_to_move(board)
    other = opponent(mover)

    if _completes_a_line(board, index, mover):
        return "win"
    if _completes_a_line(board, index, other):
        return "block"
    if _immediate_wins(place(board, index, mover), mover) >= 2:
        return "fork"
    if _can_fork(board, other) and not _can_fork(place(board, index, mover), other):
        return "block_fork"
    if index == CENTRE:
        return "centre"
    if index in OPPOSITE_CORNERS and board[OPPOSITE_CORNERS[index]] == other:
        return "opposite_corner"
    if index in CORNERS:
        return "empty_corner"
    return "empty_side"
