"""The tutorials make factual claims about tic-tac-toe. These prove them.

The claims live in `frontend/src/tutorials.json`, which the frontend also
reads, so the app cannot teach a line the solver disagrees with. A failure
here means the tutorial content is wrong, not the test.
"""

import json
from pathlib import Path
from typing import Any

import pytest

from game import Board, canonical, legal_moves, play, winner
from opponent import TRAP_KEYS
from rules import name_move
from solver import analyse_moves, evaluate

TUTORIALS_PATH = Path(__file__).resolve().parents[2] / "frontend" / "src" / "tutorials.json"
CORNERS = {0, 2, 6, 8}
SIDES = {1, 3, 5, 7}


def load_tutorials() -> list[dict[str, Any]]:
    """Read the tutorial facts the frontend ships.

    Returns:
        One dict per tutorial, as stored in tutorials.json.
    """
    return json.loads(TUTORIALS_PATH.read_text())


def trap_position(line: list[int]) -> Board:
    """Play a tutorial's three scripted moves out onto a board.

    Args:
        line: Your opening, their reply, your trap move.

    Returns:
        The position with the trap set, with the opponent to move.
    """
    board: Board = (None,) * 9
    for index in line:
        board = play(board, index)
    return board


def kind(index: int) -> str:
    """Describe a cell as a corner, a side, or the centre.

    Args:
        index: A cell index, 0-8.

    Returns:
        "corner", "side" or "centre".
    """
    if index in CORNERS:
        return "corner"
    return "side" if index in SIDES else "centre"


TUTORIALS = load_tutorials()
IDS = [tutorial["id"] for tutorial in TUTORIALS]


@pytest.mark.parametrize("tutorial", TUTORIALS, ids=IDS)
def test_their_scripted_reply_does_not_already_lose(tutorial: dict[str, Any]) -> None:
    """The trap must catch a competent novice, not a blunderer. If their reply
    already lost, the tutorial teaches nothing about the trap."""
    opening, their_reply, _ = tutorial["line"]
    board = play((None,) * 9, opening)
    verdict = next(r for r in analyse_moves(board) if r.index == their_reply)
    assert verdict.outcome != "loss"


@pytest.mark.parametrize("tutorial", TUTORIALS, ids=IDS)
def test_the_trap_offers_them_nothing_to_block(tutorial: dict[str, Any]) -> None:
    """The whole idea: no block is available, so the one rule every novice
    knows gives no warning."""
    board = trap_position(tutorial["line"])
    named = [name_move(board, r.index) for r in analyse_moves(board)]
    assert "block" not in named


@pytest.mark.parametrize("tutorial", TUTORIALS, ids=IDS)
def test_the_stated_squares_are_the_real_ones(tutorial: dict[str, Any]) -> None:
    """Every square called losing loses, every square called safe does not, and
    between them they account for every legal reply."""
    board = trap_position(tutorial["line"])
    results = {r.index: r.outcome for r in analyse_moves(board)}
    assert sorted(results) == sorted(tutorial["losing"] + tutorial["safe"])
    assert all(results[i] == "loss" for i in tutorial["losing"])
    assert all(results[i] != "loss" for i in tutorial["safe"])


@pytest.mark.parametrize("tutorial", TUTORIALS, ids=IDS)
def test_the_losing_squares_share_a_description(tutorial: dict[str, Any]) -> None:
    """The selection criterion from the spec: a line is only teachable if its
    losing squares can be named as a group. Without this there is no rule, only
    a position to memorise."""
    losing_kinds = {kind(i) for i in tutorial["losing"]}
    safe_kinds = {kind(i) for i in tutorial["safe"]}
    assert len(losing_kinds) == 1
    assert not (losing_kinds & safe_kinds)


@pytest.mark.parametrize("tutorial", TUTORIALS, ids=IDS)
def test_every_punish_wins(tutorial: dict[str, Any]) -> None:
    """Each stated punish is legal, optimal, and actually wins."""
    board = trap_position(tutorial["line"])
    assert sorted(int(k) for k in tutorial["punish"]) == sorted(tutorial["losing"])
    for their_move, punish in tutorial["punish"].items():
        after = play(board, int(their_move))
        assert punish in legal_moves(after)
        verdict = next(r for r in analyse_moves(after) if r.index == punish)
        assert verdict.outcome == "win", f"{their_move} -> {punish}"
        assert verdict.best


def test_rule_one_the_centre_is_the_only_answer_to_a_corner() -> None:
    """Tutorial 4, rule 1. Stated as corner-only because a side opening leaves
    four safe replies, which is not a rule anyone can carry."""
    for opening in CORNERS:
        board = play((None,) * 9, opening)
        safe = {r.index for r in analyse_moves(board) if r.outcome != "loss"}
        assert safe == {4}


def test_rule_two_a_corner_is_the_only_answer_to_the_centre() -> None:
    """Tutorial 4, rule 2."""
    board = play((None,) * 9, 4)
    safe = {r.index for r in analyse_moves(board) if r.outcome != "loss"}
    assert safe == CORNERS


def test_the_middle_is_always_safe_against_a_side_opening() -> None:
    """Tutorial 4's stated gap. The full safe set against a side opening is
    unmemorable, so the tutorial claims only this much — which must hold."""
    for opening in SIDES:
        board = play((None,) * 9, opening)
        verdict = next(r for r in analyse_moves(board) if r.index == 4)
        assert verdict.outcome != "loss"


def _find_traps() -> list[list[int]]:
    """Walk the whole game tree and collect every "trap" position.

    Reproduces the sweep `test_five_traps_two_clean_three_mixed` proves:
    starting from the empty board, X's move is unconstrained. O's first move
    follows Tutorial 4's rules (the centre unless X took it, in which case
    any corner); every O move after that is restricted to whatever
    `analyse_moves` does not call a loss, i.e. O never plays a losing move
    once it has the choice not to. A position counts as a trap when, with O
    to move, more than one ply has been played, O can still draw
    (`evaluate(board)[0] == 0`), no legal move is named "block", and at least
    one legal move loses — matching positions are deduplicated over the
    board's eight symmetries (four rotations, each also mirrored).

    Returns:
        One list of losing-square indices per trap found.
    """
    seen_boards: set[Board] = set()
    seen_positions: set[str] = set()
    traps: list[list[int]] = []

    def walk(board: Board) -> None:
        if board in seen_boards or winner(board) is not None or not legal_moves(board):
            return
        seen_boards.add(board)
        plies = sum(1 for cell in board if cell is not None)

        if plies % 2 == 0:  # X to move: unconstrained.
            for move in legal_moves(board):
                walk(play(board, move))
            return

        # O to move.
        results = analyse_moves(board)
        if plies > 1 and evaluate(board)[0] == 0:
            names = {name_move(board, result.index) for result in results}
            losing = [result.index for result in results if result.outcome == "loss"]
            if "block" not in names and losing:
                key = canonical(board)
                if key not in seen_positions:
                    seen_positions.add(key)
                    traps.append(losing)

        if plies == 1:
            allowed = sorted(CORNERS) if board[4] is not None else [4]
        else:
            allowed = [result.index for result in results if result.outcome != "loss"]
        for move in allowed:
            walk(play(board, move))

    walk((None,) * 9)
    return traps


def test_five_traps_two_clean_three_mixed() -> None:
    """The spec's claim: sweeping every line Tutorial 4's rules allow turns
    up exactly five trap positions (see `_find_traps` for the exact
    definition), of which two are "clean" — every losing square is the same
    kind of cell — and three are "mixed".

    The two clean traps are exactly the positions `centre-first` and
    `corner-first` teach; that is *why* those two, and not the mixed three,
    are the tutorials the spec chose to build a rule out of.
    """
    traps = _find_traps()
    assert len(traps) == 5

    clean = [losing for losing in traps if len({kind(i) for i in losing}) == 1]
    mixed = [losing for losing in traps if len({kind(i) for i in losing}) > 1]
    assert len(clean) == 2
    assert len(mixed) == 3


def test_the_trap_positions_have_three_distinct_keys() -> None:
    """The frontend tells traps apart by shape, so the shapes must differ.

    `positionKey` in frontend/src/game.js computes these same three strings and
    asserts them in game.test.js. A change to either side's symmetry code, or to
    a tutorial's line, breaks one of the two suites rather than silently
    matching the wrong tutorial to a player's loss.
    """
    keys = {
        tutorial["id"]: canonical(trap_position(tutorial["line"])) for tutorial in load_tutorials()
    }
    assert keys == {
        "centre-first": "..O.X.X..",
        "corner-first": "..X.O.X..",
        "side-first": ".....X.XO",
    }


def test_the_opponent_aims_at_the_traps_the_tutorials_teach() -> None:
    """`opponent.TRAP_KEYS` is a hand-written copy of what the tutorials teach,
    because the backend image does not contain the frontend's tutorials.json.
    This is what stops the two drifting: change a tutorial's line and the
    computer would keep steering for a position nobody is taught, silently, if
    not for this.
    """
    assert TRAP_KEYS == {
        canonical(trap_position(tutorial["line"])) for tutorial in load_tutorials()
    }
