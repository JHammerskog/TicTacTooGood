import random

from conftest import board, immediate_wins, reachable_positions

from game import Board, legal_moves, play, player_to_move, winner
from game import opponent as other_mark
from opponent import choose
from solver import analyse_moves

SAMPLES = 3


def live_positions() -> list[Board]:
    """Collect the positions where the game is still going.

    Returns:
        Every reachable board that has no winner and at least one legal move.
    """
    return [
        position
        for position in reachable_positions()
        if winner(position) is None and legal_moves(position)
    ]


def test_the_harness_finds_every_reachable_position() -> None:
    """Guards the guard: if this count drifts, every sweep below is weaker
    than it looks. 5,478 is the known number of reachable tic-tac-toe
    positions."""
    assert len(reachable_positions()) == 5478


def test_fallible_always_takes_an_immediate_win() -> None:
    """Across every position where a win is available, fallible wins the
    game outright. Asserted on the resulting board rather than on the rule
    name, so it tests the policy's effect and not its wiring."""
    rng = random.Random(0)
    checked = 0
    for position in live_positions():
        mover = player_to_move(position)
        if not immediate_wins(position, mover):
            continue
        for _ in range(SAMPLES):
            checked += 1
            assert winner(play(position, choose(position, "fallible", rng))) is not None
    assert checked > 1000


def test_fallible_never_misses_the_only_block() -> None:
    """The user's headline rule: it does not hand you the game. Restricted
    to positions where fallible has no win of its own (a win outranks a
    block) and the opponent threatens exactly one cell (two threats is a
    landed fork, which cannot be blocked)."""
    rng = random.Random(0)
    checked = 0
    for position in live_positions():
        mover = player_to_move(position)
        threat = other_mark(mover)
        if immediate_wins(position, mover):
            continue
        if len(immediate_wins(position, threat)) != 1:
            continue
        for _ in range(SAMPLES):
            checked += 1
            after = play(position, choose(position, "fallible", rng))
            assert immediate_wins(after, threat) == []
    assert checked > 1000


def test_fallible_is_neither_always_right_nor_always_wrong() -> None:
    """Fallible picks uniformly among the legal moves once nothing is forced,
    so in a quiet position it must be capable of both the optimal move and a
    worse one. Two opposite regressions are caught here: an opponent that
    quietly played perfectly, and the earlier policy that excluded optimal
    moves outright — which made it avoid, say, every corner reply to a centre
    opening, in every single game."""
    rng = random.Random(0)
    played_best = played_worse = 0
    for position in live_positions():
        mover = player_to_move(position)
        threat = other_mark(mover)
        if immediate_wins(position, mover):
            continue
        if len(immediate_wins(position, threat)) == 1:
            continue
        results = analyse_moves(position)
        best = {result.index for result in results if result.best}
        if len(best) == len(results):
            continue
        for _ in range(SAMPLES):
            if choose(position, "fallible", rng) in best:
                played_best += 1
            else:
                played_worse += 1
    assert played_best > 100, "never plays an optimal move; it is avoiding them"
    assert played_worse > 100, "never plays a worse move; it is not fallible"


def test_fallible_can_answer_a_centre_opening_with_a_corner() -> None:
    """The position that exposed the old policy. Against 4 in the centre, the
    four corners are the only drawing replies, so a policy that excluded
    optimal moves could only ever answer with a side."""
    rng = random.Random(0)
    corners = {0, 2, 6, 8}
    replies = {choose(board("....X...."), "fallible", rng) for _ in range(200)}
    assert replies & corners, "never replies with a corner"
    assert replies - corners, "never replies with anything but a corner"


def test_perfect_only_ever_plays_an_optimal_move() -> None:
    rng = random.Random(0)
    for position in live_positions():
        best = {result.index for result in analyse_moves(position) if result.best}
        for _ in range(SAMPLES):
            assert choose(position, "perfect", rng) in best


def test_both_difficulties_always_return_a_legal_move() -> None:
    rng = random.Random(0)
    for position in live_positions():
        for difficulty in ("perfect", "fallible"):
            assert choose(position, difficulty, rng) in legal_moves(position)


def test_a_finished_game_has_no_move_to_choose() -> None:
    rng = random.Random(0)
    assert choose(board("XXXOO...."), "fallible", rng) is None
    assert choose(board("XXXOO...."), "perfect", rng) is None
    assert choose(board("XXOOOXXOX"), "fallible", rng) is None


def test_the_opening_move_varies() -> None:
    """Every opening move draws, so all nine are optimal and step 3 finds no
    worse move to play. Step 4 must still return something, and it must not
    return the same cell every time."""
    rng = random.Random(0)
    openings = {choose(board("........."), "fallible", rng) for _ in range(50)}
    assert len(openings) > 1
    assert openings <= set(range(9))


def test_fallible_takes_a_free_centre_about_half_the_time() -> None:
    """A person offered an open centre takes it far more often than one time in
    nine. Asserted as a band rather than a point so the test survives a change
    of RNG, and paired with the negative case so a policy that simply always
    took the centre would fail."""
    rng = random.Random(0)
    replies = [choose(board("X........"), "fallible", rng) for _ in range(400)]
    centres = replies.count(4)
    assert 140 < centres < 260, f"took the centre {centres}/400 times"
    assert len(set(replies) - {4}) > 1, "the other half is not spread around"


def test_fallible_still_blocks_rather_than_grabbing_the_centre() -> None:
    """The centre bias sits below the forced steps, so a loss on the board
    outranks it. X threatens the top row; the centre is free and tempting."""
    rng = random.Random(0)
    for _ in range(50):
        assert choose(board("XX...O..."), "fallible", rng) == 2
