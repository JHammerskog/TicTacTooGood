# Phase 2a: Solver Engine and Analysis API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A tested `POST /api/analyse` endpoint that takes a tic-tac-toe board and returns, for every legal move, what perfect play says it leads to and what the move is called.

**Architecture:** Four small Python modules behind one thin Flask route. `game.py` holds board primitives; `solver.py` runs a memoised minimax returning outcome plus distance; `rules.py` names the pattern a move satisfies; `schemas.py` holds the Pydantic request/response models. The route parses, delegates, and serialises — no game logic in it.

**Tech Stack:** Python 3.14, Flask, Pydantic, pytest, uv for dependencies, Ruff for lint/format.

**Spec:** `docs/superpowers/specs/2026-08-24-phase2a-solver-engine-design.md`

## Global Constraints

- **Never run git commands that write state** (`add`, `commit`, `branch`, `push`). Every task ends with changes left unstaged for the user to review and commit themselves — do not run `git add`/`git commit` even though the task template would normally end that way.
- All work is inside `backend/`. **Do not touch `frontend/` at all** — Phase 2a makes no UI changes. `backend/app.py`'s existing `/api/hello` route stays exactly as it is.
- Type hints are required on every function, including tests. Docstrings on every non-test function, triple-quoted, stating args and returns.
- Imports grouped: standard library, third-party, local — Ruff's `I` rule enforces this and is already enabled.
- Ruff line-length is 100 (`backend/pyproject.toml`). Run `uv run ruff format` and `uv run ruff check` on everything you touch; both must be clean.
- Dependencies are managed with `uv` (`uv add`, `uv add --dev`), never pip and never a hand-edited `pyproject.toml` dependency list.
- **The board is a tuple, not a list, everywhere inside the engine.** `functools.lru_cache` requires hashable arguments, so `solver.py` cannot memoise a list. The route converts the incoming list to a tuple once, at the boundary.
- Board convention, matching the frontend exactly: 9 cells, each `"X"`, `"O"`, or `None`, indexed left-to-right then top-to-bottom (0 top-left, 8 bottom-right).
- `distance` means **plies remaining after the move is played**. A move completing three in a row has `distance: 0`.
- `outcome` is always from the perspective of **the player to move** on the board that was submitted.

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `backend/pyproject.toml` | Modify (Tasks 1, 4) | pytest dev dependency + pytest config (Task 1); pydantic dependency (Task 4) |
| `backend/game.py` | Create (Task 1) | Board primitives: winning lines, winner, legal moves, player to move, placement |
| `backend/tests/test_game.py` | Create (Task 1) | Tests for the primitives |
| `backend/solver.py` | Create (Task 2) | Memoised minimax; per-move outcome, distance, and optimality |
| `backend/tests/test_solver.py` | Create (Task 2) | Tests, including engine self-play |
| `backend/rules.py` | Create (Task 3) | Names the pattern a move satisfies |
| `backend/tests/test_rules.py` | Create (Task 3) | Tests for each rule predicate |
| `backend/schemas.py` | Create (Task 4) | Pydantic request/response models and validation |
| `backend/app.py` | Modify (Task 4) | Adds the `POST /api/analyse` route |
| `backend/tests/test_api.py` | Create (Task 4) | Endpoint tests via Flask's test client |

---

## Task 1: Board primitives

The vocabulary every other module speaks. Pure functions over a board tuple, no search, no naming.

**Files:**
- Create: `backend/game.py`
- Create: `backend/tests/test_game.py`
- Modify: `backend/pyproject.toml` (pytest dev dependency + pytest config)

**Interfaces:**
- Consumes: nothing.
- Produces, all importable from `game`:
  - `Board = tuple[Cell, ...]` and `Cell = str | None` — type aliases
  - `WINNING_LINES: tuple[tuple[int, int, int], ...]` — the eight triples
  - `winner(board: Board) -> tuple[str, tuple[int, int, int]] | None`
  - `legal_moves(board: Board) -> tuple[int, ...]`
  - `player_to_move(board: Board) -> str`
  - `opponent(mark: str) -> str`
  - `place(board: Board, index: int, mark: str) -> Board` — puts any mark anywhere
  - `play(board: Board, index: int) -> Board` — places the player-to-move's mark

Tasks 2, 3 and 4 all import from here. `place` exists separately from `play` because `rules.py` needs to ask hypothetical questions about the *opponent's* placement, and duplicating the slice arithmetic there would be the kind of copy-paste the review rubric flags.

- [ ] **Step 1: Add pytest and configure it**

Run from `backend/`:

```bash
uv add --dev pytest
```

Then add this block to `backend/pyproject.toml`, after the existing `[tool.ruff.lint]` section:

```toml
[tool.pytest.ini_options]
pythonpath = ["."]
testpaths = ["tests"]
```

`pythonpath = ["."]` is required: the modules live at `backend/game.py` while tests live at `backend/tests/`, and without it pytest puts only the test directory on `sys.path`, so `import game` fails.

- [ ] **Step 2: Write the failing tests**

Create `backend/tests/test_game.py`:

```python
from game import (
    Board,
    legal_moves,
    opponent,
    place,
    play,
    player_to_move,
    winner,
)


def board(cells: str) -> Board:
    """Build a board from a 9-character string, '.' meaning an empty cell."""
    return tuple(None if cell == "." else cell for cell in cells)


def test_winner_finds_a_row() -> None:
    assert winner(board("XXX.O.O..")) == ("X", (0, 1, 2))


def test_winner_finds_a_column() -> None:
    assert winner(board("X.OX.OX..")) == ("X", (0, 3, 6))


def test_winner_finds_a_diagonal() -> None:
    assert winner(board("X..OXO..X")) == ("X", (0, 4, 8))


def test_winner_reports_o_as_well_as_x() -> None:
    assert winner(board("OOOXX.X..")) == ("O", (0, 1, 2))


def test_empty_board_has_no_winner() -> None:
    assert winner(board(".........")) is None


def test_full_board_can_have_no_winner() -> None:
    assert winner(board("XXOOOXXOX")) is None


def test_legal_moves_lists_empty_cells_in_order() -> None:
    assert legal_moves(board("X.O.X...O")) == (1, 3, 5, 6, 7)


def test_legal_moves_is_empty_on_a_full_board() -> None:
    assert legal_moves(board("XXOOOXXOX")) == ()


def test_x_moves_first() -> None:
    assert player_to_move(board(".........")) == "X"


def test_o_moves_after_one_mark() -> None:
    assert player_to_move(board("X........")) == "O"


def test_x_moves_again_after_two_marks() -> None:
    assert player_to_move(board("XO.......")) == "X"


def test_opponent_flips_the_mark() -> None:
    assert opponent("X") == "O"
    assert opponent("O") == "X"


def test_place_puts_the_given_mark_at_the_index() -> None:
    assert place(board("........."), 4, "O") == board("....O....")


def test_place_does_not_mutate_the_original() -> None:
    original = board(".........")
    place(original, 0, "X")
    assert original == board(".........")


def test_play_uses_the_player_to_move() -> None:
    assert play(board("........."), 0) == board("X........")
    assert play(board("X........"), 4) == board("X...O....")
```

Note `test_place_does_not_mutate_the_original`: tuples are immutable so this cannot fail today, but it pins the contract for anyone who later "optimises" the board into a list.

- [ ] **Step 3: Run the tests to verify they fail**

Run from `backend/`:

```bash
uv run pytest tests/test_game.py -v
```

Expected: collection error — `ModuleNotFoundError: No module named 'game'`.

- [ ] **Step 4: Write the implementation**

Create `backend/game.py`:

```python
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

```

- [ ] **Step 5: Run the tests to verify they pass**

Run from `backend/`:

```bash
uv run pytest tests/test_game.py -v
```

Expected: PASS — 15 tests, 0 failures, no warnings.

- [ ] **Step 6: Format and lint**

Run from `backend/`:

```bash
uv run ruff format game.py tests/test_game.py
uv run ruff check game.py tests/test_game.py
```

Expected: `ruff check` reports `All checks passed!`.

- [ ] **Step 7: Stop — do not commit**

Leave the changes unstaged for the user to review and commit.

---

## Task 2: The search

Memoised minimax. This is the module that decides whether a move is actually good.

**Files:**
- Create: `backend/solver.py`
- Create: `backend/tests/test_solver.py`

**Interfaces:**
- Consumes, from `game`: `Board`, `legal_moves`, `play`, `winner`.
- Produces, importable from `solver`:
  - `MoveResult` — a `NamedTuple` with fields `index: int`, `outcome: str`, `distance: int`, `best: bool`
  - `evaluate(board: Board) -> tuple[int, int]` — `(score, distance)` for the player to move, score `1`/`0`/`-1`
  - `analyse_moves(board: Board) -> list[MoveResult]` — one entry per legal move, ascending by index

Task 4 imports `analyse_moves` and reads `.index`, `.outcome`, `.distance`, `.best` off each result.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_solver.py`:

```python
from game import Board, legal_moves, play, winner
from solver import analyse_moves, evaluate


def board(cells: str) -> Board:
    """Build a board from a 9-character string, '.' meaning an empty cell."""
    return tuple(None if cell == "." else cell for cell in cells)


def test_perfect_play_from_an_empty_board_is_a_draw() -> None:
    """Tic-tac-toe is a solved draw. Self-play is the strongest single check
    on the search: a wrong perspective, a sign error, or mishandled distance
    all break this."""
    position = board(".........")
    while legal_moves(position):
        best = next(move for move in analyse_moves(position) if move.best)
        position = play(position, best.index)
        if winner(position) is not None:
            break
    assert winner(position) is None
    assert legal_moves(position) == ()


def test_every_opening_move_draws() -> None:
    """No first move wins or loses against perfect defence."""
    moves = analyse_moves(board("........."))
    assert len(moves) == 9
    assert {move.outcome for move in moves} == {"draw"}
    assert all(move.best for move in moves)


def test_a_winning_move_is_reported_as_a_win_at_distance_zero() -> None:
    # X to play; 2 completes the top row.
    moves = {move.index: move for move in analyse_moves(board("XX.OO...."))}
    assert moves[2].outcome == "win"
    assert moves[2].distance == 0
    assert moves[2].best is True


def test_the_only_saving_move_is_the_one_marked_best() -> None:
    # O to play and X threatens 2 to complete the top row. O must block there.
    moves = {move.index: move for move in analyse_moves(board("XX.O....."))}
    assert moves[2].best is True
    assert [index for index, move in moves.items() if move.best] == [2]


def test_evaluate_scores_a_lost_position_for_the_player_to_move() -> None:
    # X has already won; O is nominally to move and has lost.
    score, distance = evaluate(board("XXXOO...."))
    assert score == -1
    assert distance == 0


def test_evaluate_scores_a_full_drawn_board_as_a_draw() -> None:
    score, distance = evaluate(board("XXOOOXXOX"))
    assert score == 0
    assert distance == 0


def test_a_winning_fork_is_recognised_as_the_best_move() -> None:
    """A real tactic the search must find: X forks at corner 0, opening both
    (0, 3, 6) and (0, 4, 8), and O cannot block both."""
    moves = {move.index: move for move in analyse_moves(board(".....OXOX"))}
    assert moves[0].outcome == "win"
    assert moves[0].best is True


def test_a_faster_win_is_preferred_over_a_slower_one() -> None:
    """Distance is what stops a winning engine dawdling.

    This fixture must have two moves that BOTH win at DIFFERENT distances,
    or the assertions pass trivially and the tie-break goes untested. X to
    play: 8 wins immediately, 4 also wins but two plies later.
    """
    moves = {move.index: move for move in analyse_moves(board("XOXO.X.O."))}
    assert moves[8].outcome == "win"
    assert moves[4].outcome == "win"
    assert moves[8].distance == 0
    assert moves[4].distance == 2
    assert moves[8].best is True
    assert moves[4].best is False


def test_a_slower_loss_is_preferred_over_a_faster_one() -> None:
    """The mirror of the rule above: when every move loses, the best move is
    the one that survives longest, because it gives the opponent more chances
    to err. O to play and lost whatever it does — five moves lose on the next
    ply, and only 8 holds out to three.
    """
    moves = {move.index: move for move in analyse_moves(board("XO..X...."))}
    assert {move.outcome for move in moves.values()} == {"loss"}
    assert moves[8].distance == 3
    assert moves[8].best is True
    assert [index for index, move in moves.items() if move.best] == [8]
```

- [ ] **Step 2: Run the tests to verify they fail**

Run from `backend/`:

```bash
uv run pytest tests/test_solver.py -v
```

Expected: collection error — `ModuleNotFoundError: No module named 'solver'`.

- [ ] **Step 3: Write the implementation**

Create `backend/solver.py`:

```python
from functools import lru_cache
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


def _preferred(candidate: tuple[int, int], incumbent: tuple[int, int]) -> bool:
    """Decide whether one (score, distance) pair beats another.

    Winning sooner is better than winning later; losing later is better than
    losing sooner, because it gives the opponent more chances to err. Draws
    prefer the shorter line so the choice is deterministic.

    Args:
        candidate: The (score, distance) pair being considered.
        incumbent: The best pair found so far.

    Returns:
        True if the candidate is strictly better.
    """
    score, distance = candidate
    best_score, best_distance = incumbent
    if score != best_score:
        return score > best_score
    if score < 0:
        return distance > best_distance
    return distance < best_distance


@lru_cache(maxsize=None)
def evaluate(board: Board) -> tuple[int, int]:
    """Score a position for whoever is to move.

    Memoised: only 5,478 positions are reachable, so the whole game tree is
    effectively free after the first traversal.

    Args:
        board: Nine cells. Must be a tuple — lru_cache requires hashability.

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
        if best is None or _preferred(candidate, best):
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


def _rank(pair: tuple[int, int]) -> tuple[int, int]:
    """Sort key ordering (score, distance) pairs best-first.

    Args:
        pair: A (score, distance) pair.

    Returns:
        A tuple that sorts ascending from best to worst.
    """
    score, distance = pair
    return (-score, -distance if score < 0 else distance)
```

Note the distance difference between the two functions: `evaluate` counts the plies remaining *including* the move it is about to make, so it adds one; `analyse_moves` reports the plies remaining *after* the move, so it does not. That is what makes a winning move `distance: 0`, per the spec.

- [ ] **Step 4: Run the tests to verify they pass**

Run from `backend/`:

```bash
uv run pytest tests/test_solver.py -v
```

Expected: PASS — 9 tests, 0 failures, no warnings.

- [ ] **Step 5: Run the whole suite**

Run from `backend/`:

```bash
uv run pytest -v
```

Expected: PASS — Task 1's 15 tests plus these 9.

- [ ] **Step 6: Format and lint**

Run from `backend/`:

```bash
uv run ruff format solver.py tests/test_solver.py
uv run ruff check solver.py tests/test_solver.py
```

Expected: `All checks passed!`.

- [ ] **Step 7: Stop — do not commit**

Leave the changes unstaged for the user to review and commit.

---

## Task 3: The naming layer

What a move is *called*. Independent of whether it is any good — the solver already answers that.

**Files:**
- Create: `backend/rules.py`
- Create: `backend/tests/test_rules.py`

**Interfaces:**
- Consumes, from `game`: `Board`, `legal_moves`, `opponent`, `place`, `player_to_move`, `winner`.
- Produces, importable from `rules`: `name_move(board: Board, index: int) -> str`, returning exactly one of `"win"`, `"block"`, `"fork"`, `"block_fork"`, `"centre"`, `"opposite_corner"`, `"empty_corner"`, `"empty_side"`.

Task 4 calls `name_move(board, index)` for each legal move.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_rules.py`:

```python
from game import Board, legal_moves
from rules import name_move


def board(cells: str) -> Board:
    """Build a board from a 9-character string, '.' meaning an empty cell."""
    return tuple(None if cell == "." else cell for cell in cells)


def test_completing_a_line_is_a_win() -> None:
    # X to play; 2 completes the top row.
    assert name_move(board("XX.OO...."), 2) == "win"


def test_denying_an_opponent_line_is_a_block() -> None:
    # O to play; X threatens 2, so 2 is a block.
    assert name_move(board("XX.O....."), 2) == "block"


def test_winning_outranks_blocking() -> None:
    # Cell 2 is genuinely BOTH: X to play completes X's row (0, 1, 2), and O
    # playing there would complete O's line (2, 4, 6). Both predicates are
    # independently true, so this actually exercises the priority order —
    # a fixture where only one is true would pass whatever the order was.
    assert name_move(board("XX..O.O.."), 2) == "win"


def test_creating_two_threats_is_a_fork() -> None:
    # X holds the bottom corners 6 and 8, O holds the sides 5 and 7, X to
    # play. Taking corner 0 opens both (0, 3, 6) and (0, 4, 8) — two winning
    # replies, and O cannot block both.
    assert name_move(board(".....OXOX"), 0) == "fork"


def test_a_move_that_removes_the_fork_threat_is_a_block_fork() -> None:
    # X holds the bottom corners 6 and 8, O holds 7, O to play. X forks unless
    # O takes the centre, and the centre is the ONLY move that removes the
    # threat. It also proves block_fork outranks centre in the priority order.
    assert name_move(board("......XOX"), 4) == "block_fork"


def test_the_middle_cell_is_the_centre() -> None:
    assert name_move(board("........."), 4) == "centre"


def test_a_corner_diagonally_opposite_the_opponent_is_the_opposite_corner() -> None:
    # X to play; O holds corner 0, so corner 8 is the opposite corner.
    assert name_move(board("OX......."), 8) == "opposite_corner"


def test_a_free_corner_with_no_opponent_opposite_is_an_empty_corner() -> None:
    assert name_move(board("........."), 0) == "empty_corner"


def test_an_edge_cell_is_an_empty_side() -> None:
    assert name_move(board("........."), 1) == "empty_side"


def test_every_legal_move_on_an_empty_board_gets_a_name() -> None:
    """centre, the four corners and the four sides cover all nine cells, so
    no legal move is ever nameless."""
    empty = board(".........")
    names = [name_move(empty, index) for index in legal_moves(empty)]
    assert len(names) == 9
    assert all(name for name in names)
```

- [ ] **Step 2: Run the tests to verify they fail**

Run from `backend/`:

```bash
uv run pytest tests/test_rules.py -v
```

Expected: collection error — `ModuleNotFoundError: No module named 'rules'`.

- [ ] **Step 3: Write the implementation**

Create `backend/rules.py`:

```python
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run from `backend/`:

```bash
uv run pytest tests/test_rules.py -v
```

Expected: PASS — 10 tests, 0 failures, no warnings.

If a fork or block-fork fixture does not produce the expected name, do **not** loosen the assertion to make it green. Work out by hand which cells are threats in that position, and either fix the predicate or correct the fixture to a position that genuinely has the pattern — then say which you did in your report.

- [ ] **Step 5: Run the whole suite**

Run from `backend/`:

```bash
uv run pytest -v
```

Expected: PASS — all tests from Tasks 1, 2 and 3.

- [ ] **Step 6: Format and lint**

Run from `backend/`:

```bash
uv run ruff format rules.py tests/test_rules.py
uv run ruff check rules.py tests/test_rules.py
```

Expected: `All checks passed!`.

- [ ] **Step 7: Stop — do not commit**

Leave the changes unstaged for the user to review and commit.

---

## Task 4: Schemas and the endpoint

The boundary: validate what comes in, delegate, serialise what goes out.

**Files:**
- Create: `backend/schemas.py`
- Create: `backend/tests/test_api.py`
- Modify: `backend/app.py` (add the route; leave `/api/hello` untouched)
- Modify: `backend/pyproject.toml` (pydantic dependency, via `uv add`)

**Interfaces:**
- Consumes: `game.legal_moves`, `game.player_to_move`, `game.winner`, `game.WINNING_LINES`, `rules.name_move`, `solver.analyse_moves`.
- Produces: `POST /api/analyse`.

- [ ] **Step 1: Add pydantic**

Run from `backend/`:

```bash
uv add pydantic
```

- [ ] **Step 2: Write the failing tests**

Create `backend/tests/test_api.py`:

```python
import pytest
from flask.testing import FlaskClient

from app import app


@pytest.fixture
def client() -> FlaskClient:
    """Provide a Flask test client for the API."""
    app.config["TESTING"] = True
    return app.test_client()


def cells(text: str) -> list[str | None]:
    """Build a request board from a 9-character string, '.' meaning empty."""
    return [None if cell == "." else cell for cell in text]


def test_empty_board_returns_nine_drawing_moves(client: FlaskClient) -> None:
    response = client.post("/api/analyse", json={"board": cells(".........")})
    assert response.status_code == 200
    body = response.get_json()
    assert body["status"] == "in_progress"
    assert body["player"] == "X"
    assert body["winner"] is None
    assert body["winning_line"] is None
    assert len(body["moves"]) == 9
    assert {move["outcome"] for move in body["moves"]} == {"draw"}


def test_every_move_carries_a_rule_name(client: FlaskClient) -> None:
    response = client.post("/api/analyse", json={"board": cells(".........")})
    moves = response.get_json()["moves"]
    assert all(move["rule"] for move in moves)
    assert next(move for move in moves if move["index"] == 4)["rule"] == "centre"


def test_a_won_board_reports_the_winner_and_no_moves(client: FlaskClient) -> None:
    response = client.post("/api/analyse", json={"board": cells("XXXOO....")})
    assert response.status_code == 200
    body = response.get_json()
    assert body["status"] == "won"
    assert body["winner"] == "X"
    assert body["winning_line"] == [0, 1, 2]
    assert body["player"] is None
    assert body["moves"] == []


def test_a_drawn_board_reports_drawn_and_no_moves(client: FlaskClient) -> None:
    response = client.post("/api/analyse", json={"board": cells("XXOOOXXOX")})
    assert response.status_code == 200
    body = response.get_json()
    assert body["status"] == "drawn"
    assert body["winner"] is None
    assert body["moves"] == []


def test_a_short_board_is_rejected(client: FlaskClient) -> None:
    response = client.post("/api/analyse", json={"board": cells("........")})
    assert response.status_code == 400
    assert response.get_json()["error"]


def test_a_long_board_is_rejected(client: FlaskClient) -> None:
    response = client.post("/api/analyse", json={"board": ["X"] * 10})
    assert response.status_code == 400


def test_an_impossible_move_count_is_rejected(client: FlaskClient) -> None:
    response = client.post("/api/analyse", json={"board": cells("XXX......")})
    assert response.status_code == 400
    assert "X" in response.get_json()["error"]


def test_a_board_with_two_winners_is_rejected(client: FlaskClient) -> None:
    response = client.post("/api/analyse", json={"board": cells("XXXOOO...")})
    assert response.status_code == 400


def test_a_missing_body_is_rejected(client: FlaskClient) -> None:
    response = client.post("/api/analyse", json={})
    assert response.status_code == 400
    # The message must name the field, not just say "Field required".
    assert "board" in response.get_json()["error"]


def test_hello_route_still_works(client: FlaskClient) -> None:
    """Phase 2a must not disturb the existing endpoint."""
    response = client.get("/api/hello")
    assert response.status_code == 200
    assert response.get_json() == {"message": "Hello from Flask"}
```

- [ ] **Step 3: Run the tests to verify they fail**

Run from `backend/`:

```bash
uv run pytest tests/test_api.py -v
```

Expected: FAIL — the `/api/analyse` tests return 404 because the route does not exist. `test_hello_route_still_works` passes already, which is correct: it is a regression guard, not a new feature.

- [ ] **Step 4: Write the schemas**

Create `backend/schemas.py`:

```python
from typing import Annotated, Literal

from pydantic import BaseModel, Field, field_validator

from game import WINNING_LINES

Cell = Literal["X", "O"] | None

RuleName = Literal[
    "win",
    "block",
    "fork",
    "block_fork",
    "centre",
    "opposite_corner",
    "empty_corner",
    "empty_side",
]


class AnalyseRequest(BaseModel):
    """A board submitted for analysis."""

    board: Annotated[list[Cell], Field(min_length=9, max_length=9)]

    @field_validator("board")
    @classmethod
    def check_reachable(cls, board: list[Cell]) -> list[Cell]:
        """Reject boards that no real game could have produced.

        Args:
            board: The nine submitted cells.

        Returns:
            The board unchanged, if it is reachable.

        Raises:
            ValueError: If the move counts are impossible or both players
                hold a completed line.
        """
        exes = board.count("X")
        ohs = board.count("O")
        if exes not in (ohs, ohs + 1):
            raise ValueError(
                f"Unreachable board: {exes} X and {ohs} O. X moves first, so the number of X "
                f"must equal the number of O or exceed it by exactly one."
            )
        winners = {
            board[a]
            for a, b, c in WINNING_LINES
            if board[a] is not None and board[a] == board[b] == board[c]
        }
        if len(winners) > 1:
            raise ValueError("Unreachable board: both players hold a completed line.")
        return board


class MoveAnalysis(BaseModel):
    """One legal move's verdict and name."""

    index: int
    outcome: Literal["win", "draw", "loss"]
    distance: int
    rule: RuleName
    best: bool


class AnalyseResponse(BaseModel):
    """The full analysis of a submitted board."""

    status: Literal["in_progress", "won", "drawn"]
    player: Literal["X", "O"] | None
    winner: Literal["X", "O"] | None
    winning_line: list[int] | None
    moves: list[MoveAnalysis]
```

- [ ] **Step 5: Add the route**

Modify `backend/app.py`. Replace its import block and append the new route, leaving the existing `hello` function and the `__main__` block exactly as they are:

```python
from flask import Flask, jsonify, request
from flask_cors import CORS
from pydantic import ValidationError

from game import legal_moves, player_to_move, winner
from rules import name_move
from schemas import AnalyseRequest, AnalyseResponse, MoveAnalysis
from solver import analyse_moves

app = Flask(__name__)
CORS(app)
```

and add, after the existing `hello` route:

```python
def _first_problem(error: ValidationError) -> str:
    """Render a validation failure as a message naming the field and the problem.

    Pydantic reports the offending field in `loc` and the reason in `msg`, and
    prefixes messages raised by custom validators with "Value error, ". Sending
    only `msg` would answer "Field required" without saying which field.

    Args:
        error: The exception raised by `model_validate`.

    Returns:
        A single-line message such as
        "board: List should have at least 9 items after validation, not 8".
    """
    first = error.errors()[0]
    location = ".".join(str(part) for part in first["loc"]) or "request body"
    return f"{location}: {first['msg'].removeprefix('Value error, ')}"


@app.post("/api/analyse")
def analyse() -> tuple[dict[str, object], int]:
    """Analyse a board: what every legal move leads to, and what it is called.

    Returns:
        The analysis and HTTP 200, or an error message and HTTP 400 when the
        submitted board is malformed or unreachable.
    """
    try:
        payload = AnalyseRequest.model_validate(request.get_json(silent=True) or {})
    except ValidationError as error:
        return jsonify(error=_first_problem(error)), 400

    board = tuple(payload.board)
    won = winner(board)
    if won is not None:
        status, winning_mark, winning_line = "won", won[0], list(won[1])
    elif not legal_moves(board):
        status, winning_mark, winning_line = "drawn", None, None
    else:
        status, winning_mark, winning_line = "in_progress", None, None

    moves = (
        [
            MoveAnalysis(
                index=result.index,
                outcome=result.outcome,
                distance=result.distance,
                rule=name_move(board, result.index),
                best=result.best,
            )
            for result in analyse_moves(board)
        ]
        if status == "in_progress"
        else []
    )

    response = AnalyseResponse(
        status=status,
        player=player_to_move(board) if status == "in_progress" else None,
        winner=winning_mark,
        winning_line=winning_line,
        moves=moves,
    )
    return response.model_dump(), 200
```

`request.get_json(silent=True) or {}` is deliberate: a missing or non-JSON body becomes an empty dict, which Pydantic then rejects with a clear "field required" message instead of Flask raising a 415 or 500.

- [ ] **Step 6: Run the tests to verify they pass**

Run from `backend/`:

```bash
uv run pytest tests/test_api.py -v
```

Expected: PASS — 10 tests, 0 failures, no warnings.

- [ ] **Step 7: Run the whole suite**

Run from `backend/`:

```bash
uv run pytest -v
```

Expected: PASS — every test from Tasks 1 through 4.

- [ ] **Step 8: Format and lint**

Run from `backend/`:

```bash
uv run ruff format app.py schemas.py tests/test_api.py
uv run ruff check .
```

Expected: `All checks passed!` across the whole backend.

- [ ] **Step 9: Verify against the running container**

The backend image installs dependencies at build time, so adding pydantic requires a rebuild. Run from the repository root:

```bash
docker compose up --build -d backend
curl -s -X POST http://localhost:5000/api/analyse \
  -H 'Content-Type: application/json' \
  -d '{"board":["X","X",null,"O","O",null,null,null,null]}'
```

Expected: HTTP 200 with JSON in which the move at index 2 has `"outcome": "win"`, `"distance": 0`, `"rule": "win"` and `"best": true`.

Then confirm a rejection:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:5000/api/analyse \
  -H 'Content-Type: application/json' -d '{"board":["X","X","X",null,null,null,null,null,null]}'
```

Expected: `400`.

- [ ] **Step 10: Stop — do not commit**

Leave the changes unstaged for the user to review and commit. This completes Phase 2a.

---

## Phase 2a done means

- `POST /api/analyse` returns per-move outcome, distance, rule name and optimality for every legal move.
- Terminal boards return the status, winner and winning line with an empty move list.
- Malformed and unreachable boards are rejected with 400 and a message naming the problem.
- The engine self-plays to a draw from an empty board.
- `uv run pytest` and `uv run ruff check .` both pass.
- `frontend/` is byte-for-byte unchanged, and `/api/hello` still works.
