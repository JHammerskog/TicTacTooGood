import random
from typing import Literal

from game import Board, legal_moves
from rules import name_move
from solver import analyse_moves

Difficulty = Literal["perfect", "fallible"]


def choose(board: Board, difficulty: Difficulty, rng: random.Random) -> int | None:
    """Pick the computer's move.

    "perfect" chooses at random among the optimal moves. Every one of them is
    optimal, so this is still perfect play; it only stops the computer playing
    an identical game every time.

    "fallible" models a competent human rather than a weakened engine. It never
    misses a win or a losing block; beyond those it simply guesses:

        1. a move named "win"    -> play it
        2. a move named "block"  -> play it
        3. otherwise             -> play any legal move at random

    Step 3 draws from ALL legal moves, deliberately including the optimal ones.
    An earlier version drew only from the non-optimal moves, which sounds more
    fallible but plays far worse than a person: whenever the optimal replies
    form a natural group it took the complement every time, so against a centre
    opening — where the four corners are the only drawing replies — it answered
    with a side in 100% of games. Guessing uniformly instead lets it stumble
    onto the right move about 38% of the time, which is what a human does.

    Step 2 can find two blocking moves, which means the opponent already has two
    immediate threats. Blocking one still loses, but nothing is lost by it: in
    such a position every legal move is tied-optimal.

    Args:
        board: The position to move in.
        difficulty: "perfect" or "fallible".
        rng: The source of randomness, passed in so tests are deterministic.

    Returns:
        The index to play, or None if the game is already over.
    """
    results = analyse_moves(board)
    if not results:
        return None

    if difficulty == "perfect":
        return rng.choice([result.index for result in results if result.best])

    named = {result.index: name_move(board, result.index) for result in results}
    for wanted in ("win", "block"):
        forced = [index for index, name in named.items() if name == wanted]
        if forced:
            return rng.choice(forced)

    return rng.choice(legal_moves(board))
