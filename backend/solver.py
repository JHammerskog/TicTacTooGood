from functools import cache
from typing import NamedTuple

from game import Board, legal_moves, play, winner

_OUTCOMES: dict[int, str] = {1: "win", 0: "draw", -1: "loss"}


class MoveResult(NamedTuple):
    """One legal move's verdict under perfect play.

    Attributes:
        index: The cell this move plays.
        outcome: "win", "draw" or "loss", from the perspective of the player
            to move on the board that was analysed.
        distance: Plies remaining AFTER this move is played, until the game
            ends under optimal play. A move completing three in a row is 0.
            Note this differs from `evaluate`, which counts the move it is
            about to make; see that function's docstring.
        best: Whether this move is optimal. Several moves can be best at once.
    """

    index: int
    outcome: str
    distance: int
    best: bool


def _rank(pair: tuple[int, int]) -> tuple[int, int]:
    """Sort key ordering (score, distance) pairs best-first.

    Winning sooner is better than winning later; losing later is better than
    losing sooner, because it gives the opponent more chances to err. Draws
    prefer the shorter line so the choice is deterministic.

    Args:
        pair: A (score, distance) pair.

    Returns:
        A tuple that sorts ascending from best to worst.
    """
    score, distance = pair
    return (-score, -distance if score < 0 else distance)


@cache
def evaluate(board: Board) -> tuple[int, int]:
    """Score a position for whoever is to move.

    Memoised: only 5,478 positions are reachable, so the whole game tree is
    effectively free after the first traversal.

    Args:
        board: Nine cells. Must be a tuple — the cache requires hashability.

    Returns:
        (score, distance). Score is 1 for a win, 0 for a draw, -1 for a loss,
        from the perspective of the player to move. Distance is the number of
        plies remaining until the game ends under optimal play.
    """
    if winner(board) is not None:
        # Whoever is to move faces a board their opponent has already won.
        return -1, 0
    moves = legal_moves(board)
    if not moves:
        return 0, 0
    best: tuple[int, int] | None = None
    for index in moves:
        opponent_score, opponent_distance = evaluate(play(board, index))
        candidate = (-opponent_score, opponent_distance + 1)
        if best is None or _rank(candidate) < _rank(best):
            best = candidate
    assert best is not None  # `moves` is non-empty, so the loop always runs.
    return best


def analyse_moves(board: Board) -> list[MoveResult]:
    """Evaluate every legal move on a board.

    Args:
        board: Nine cells, with the game still in progress.

    Returns:
        One MoveResult per legal move, ascending by index. Each result's
        `distance` is the plies remaining AFTER that move is played — one
        less than `evaluate` would report for the same line, because
        `evaluate` counts the move it is about to make. Several moves can be
        `best` at once — from an empty board every move draws, and none is
        better than another.
    """
    if winner(board) is not None:
        return []
    scored: dict[int, tuple[int, int]] = {}
    for index in legal_moves(board):
        opponent_score, opponent_distance = evaluate(play(board, index))
        scored[index] = (-opponent_score, opponent_distance)
    if not scored:
        return []
    optimal = scored[min(scored, key=lambda index: _rank(scored[index]))]
    return [
        MoveResult(
            index=index,
            outcome=_OUTCOMES[score],
            distance=distance,
            best=(score, distance) == optimal,
        )
        for index, (score, distance) in scored.items()
    ]
