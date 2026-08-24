from game import Board


def board(cells: str) -> Board:
    """Build a board from a 9-character string, '.' meaning an empty cell."""
    return tuple(None if cell == "." else cell for cell in cells)
