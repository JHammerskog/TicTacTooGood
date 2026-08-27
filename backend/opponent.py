import random
from collections.abc import Iterable
from typing import Literal

from game import Board, canonical, legal_moves, play
from rules import name_move
from solver import analyse_moves

Difficulty = Literal["perfect", "fallible"]

CENTRE = 4

# How often a guessing opponent takes a free centre. Not a tuned number: it is
# "often, but not always", which is how a person plays it.
CENTRE_BIAS = 0.5

# The three positions the tutorials teach, keyed by shape so a rotation or
# reflection of one still counts. Kept here rather than read from the frontend's
# tutorials.json, which is not in the backend image; the backend suite pins
# these against that file, which is what stops the two drifting apart.
TRAP_KEYS = frozenset({"..O.X.X..", "..X.O.X..", ".....X.XO"})

# How often the computer DELIBERATELY sets a taught trap when it can. Without
# this it picked uniformly among the optimal moves and so almost never built
# one, which left the app teaching three traps a player would never meet while
# playing it. Perfect leans on it hard; fallible knows the shape rather than
# having studied it.
#
# The observed rate runs higher than the number here, because a move not taken
# deliberately can still be guessed: fallible's 0.25 shows up as roughly 0.35
# once its uniform fallback stumbles onto the same square. Removing the trap
# from that fallback would make the figure exact and the opponent worse — see
# step 5 below for the same mistake made with optimal moves.
TRAP_BIAS: dict[Difficulty, float] = {"perfect": 0.75, "fallible": 0.25}


def _trap_moves(board: Board, candidates: Iterable[int]) -> list[int]:
    """Which of these moves reach a position the tutorials teach.

    Only ever non-empty when the board holds two marks: a taught trap is two X
    and one O with O to move, so the move that completes one is always the third
    of the game. That also means a computer playing second can never trigger the
    bias, which is why nothing guards for it.

    Args:
        board: The position to move in.
        candidates: The moves worth considering.

    Returns:
        Those candidates that produce a taught trap, in the order given.
    """
    return [index for index in candidates if canonical(play(board, index)) in TRAP_KEYS]


def choose(board: Board, difficulty: Difficulty, rng: random.Random) -> int | None:
    """Pick the computer's move.

    "perfect" chooses at random among the optimal moves, leaning toward one that
    sets a trap the tutorials teach. Every candidate is optimal either way, so
    this is still perfect play: the bias picks which draw to steer for, never
    whether to draw.

    "fallible" models a competent human rather than a weakened engine. It never
    misses a win or a losing block; beyond those it simply guesses:

        1. a move named "win"      -> play it
        2. a move named "block"    -> play it
        3. a taught trap on offer  -> play it a quarter of the time
        4. a free centre           -> play it half the time
        5. otherwise               -> play any other legal move at random

    Step 5 draws from ALL remaining legal moves, deliberately including the
    optimal ones. An earlier version drew only from the non-optimal moves, which
    sounds more fallible but plays far worse than a person: whenever the optimal
    replies form a natural group it took the complement every time, so against a
    centre opening — where the four corners are the only drawing replies — it
    answered with a side in 100% of games. Guessing uniformly instead lets it
    stumble onto the right move about 38% of the time, which is what a human
    does.

    Step 3 sits below the forced steps so a win or a block always outranks it,
    and it is deliberately much weaker than perfect's: this opponent is meant to
    play like someone who knows the shape, not someone who has studied it.

    Step 4 exists because uniform guessing is *too* random in one specific way:
    a person offered a free centre takes it far more often than one time in
    nine. Leaving it to chance produced games where the computer ignored an open
    centre move after move, which reads as broken rather than fallible.

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
        best = [result.index for result in results if result.best]
        traps = _trap_moves(board, best)
        if traps and rng.random() < TRAP_BIAS["perfect"]:
            return rng.choice(traps)
        return rng.choice(best)

    named = {result.index: name_move(board, result.index) for result in results}
    for wanted in ("win", "block"):
        forced = [index for index, name in named.items() if name == wanted]
        if forced:
            return rng.choice(forced)

    free = legal_moves(board)
    traps = _trap_moves(board, free)
    if traps and rng.random() < TRAP_BIAS["fallible"]:
        return rng.choice(traps)

    others = [index for index in free if index != CENTRE]
    if CENTRE in free and (not others or rng.random() < CENTRE_BIAS):
        return CENTRE
    return rng.choice(others)
