from game import Board, legal_moves, place, play, winner


def board(cells: str) -> Board:
    """Build a board from a 9-character string, '.' meaning an empty cell."""
    return tuple(None if cell == "." else cell for cell in cells)


def reachable_positions() -> list[Board]:
    """Enumerate every position a real game of tic-tac-toe can produce.

    Breadth-first from the empty board, alternating legal moves and never
    expanding a position someone has already won. There are 5,478 of them,
    which is small enough to assert an invariant across all of them.

    Returns:
        Every reachable board, including terminal ones.
    """
    empty: Board = tuple([None] * 9)
    seen = {empty}
    frontier = [empty]
    found = []
    while frontier:
        following = []
        for position in frontier:
            found.append(position)
            if winner(position) is not None:
                continue
            for index in legal_moves(position):
                child = play(position, index)
                if child not in seen:
                    seen.add(child)
                    following.append(child)
        frontier = following
    return found


def immediate_wins(board: Board, mark: str) -> list[int]:
    """Find the cells where `mark` would complete a line right now.

    Args:
        board: The position to inspect.
        mark: "X" or "O".

    Returns:
        Every legal index that completes three in a row for `mark`.
    """
    return [index for index in legal_moves(board) if winner(place(board, index, mark)) is not None]
