"""Perfect play for tic-tac-toe, by minimax search.

Minimax answers "what happens if both sides play as well as possible?" There is
no guessing and no heuristic: the game is small enough to look at every position
that can follow from this one, all the way to the end, and read the answer off
the bottom.

The recursion is one sentence: **the value of a position is the best value among
the positions you can move to, seen from the other player's side and flipped.**

That flip is the whole trick, and it is what `evaluate` is doing here::

    opponent_score, _ = evaluate(play(board, index))
    candidate = -opponent_score

`evaluate` always answers from the point of view of whoever is to move on the
board it was handed. So once you play your move, the recursive call speaks for
your *opponent* — and their win is your loss. Negating converts their verdict
back into yours. Because every level flips, the code can simply take the best
candidate at every level instead of alternating "maximise mine" and "minimise
theirs"; the two are the same search written differently.

Recursion has to stop somewhere, and here it stops on the two ways a game of
tic-tac-toe can end:

- somebody has completed a line, which means the player now to move has already
  lost, so the position scores -1;
- no cells are left and nobody won, so it scores 0.

Nothing else needs a rule. Every other position gets its value from its
children, and since each move fills a cell, every branch reaches one of those
two endings within nine plies.

Alongside the score the search carries a *distance* — how many plies remain
until the game ends. Without it every win looks alike, and the engine would
happily take a win in five when a win in one was available, because both score
1. `_rank` uses it to prefer winning sooner and losing later.
"""

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
