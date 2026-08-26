# Phase 4: Strategy Tutorials — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Teach four named strategies — three traps and one defence — each walked through with commentary, then practised against an opponent scripted to fall for it.

**Architecture:** Tutorials are content, not engine. The facts (which squares lose, which punish move wins) live in one JSON file read by both the frontend and a Python test, so the app cannot teach something the solver disagrees with. The watch phase is Phase 3's history navigation driven by a scripted array of boards rather than a played game, which is why this phase begins by extracting that navigation into a hook. The scripted opponent is a list of replies consumed in order — no policy, no round trip.

**Tech Stack:** React 19, Vite, Bootstrap 5.3, oxlint, Prettier, `node --test`. Backend gains one test file only: Python 3.14, pytest, Ruff, uv.

**Spec:** `docs/superpowers/specs/2026-08-26-phase4-tutorials-design.md`

## Global Constraints

- **Never run git commands that write state** (`add`, `commit`, `branch`, `push`, `stash`, `checkout`, `restore`). This project's CLAUDE.md reserves all of them for the user. Read-only git is fine. Every task ends with changes left unstaged, and the "Commit" step in each task means **report that the task is ready to commit** — do not run `git commit`.
- **JavaScript:** ES6+, semicolons, Prettier defaults (80-col print width). Run `npx prettier --write` on every file you touch and confirm `npx prettier --check src/` passes before reporting.
- **`npm run lint` must emit nothing at all** — not even a warning.
- **JSDoc on every exported function in `game.js` and `tutorials.js`**, matching the style already there (description, `@param` with types, `@returns` with type and meaning).
- **Python:** type hints on every function, triple-quoted docstrings with Args/Returns, imports grouped stdlib / third-party / local. `uv run ruff check .` and `uv run ruff format --check .` must both pass.
- **Bootstrap 5 utilities first**; custom CSS only for what Bootstrap cannot express, in `index.css`, reusing the `var(--bs-*)` tokens already there.
- **Accessibility:** colour is never the only channel; controls are keyboard-reachable; mutually exclusive choices are radio groups, binary ones are switches. Lighthouse Accessibility and Best Practices must stay at 100 in **both** themes.
- **No new dependencies.** No component test framework — that decision is recorded in the Phase 2b spec. Components are verified in the browser via the chrome-devtools MCP, as in Phases 2b and 3.
- **No production backend change.** `backend/app.py`, `solver.py`, `rules.py`, `opponent.py`, `game.py` and `schemas.py` must not be modified. The only backend file this phase adds is `backend/tests/test_tutorials.py`. If you believe a production backend change is needed, stop and report it — the spec says that is a signal the design is wrong.
- **Baselines at the start of this phase:** frontend `npm test` reports **38 tests / 38 pass**; backend `uv run pytest` reports **63 passed**. Every task must leave both suites green, and tasks that add tests must report the new totals.
- Frontend commands run in `frontend/`, backend commands in `backend/`. `node_modules` and `.venv` are present.

## File Structure

| File | Responsibility |
|---|---|
| `frontend/src/useGameHistory.js` (new) | `history` + `cursor` + replay target, and the navigation helpers. Extracted from `Game.jsx`; driven by a played game or by a scripted line. |
| `frontend/src/tutorials.json` (new) | The **facts**: each tutorial's line, its losing and safe squares, and the punish for each losing reply. Read by the frontend and by a Python test, so the two cannot drift. |
| `frontend/src/tutorials.js` (new) | The **prose**, plus derivation of each tutorial's step boards from its line, the scripted opponent, and the expected-move check. Pure and unit-tested. |
| `frontend/src/LearnList.jsx` (new) | The Learn section on the start screen: four tutorials by name, with completion ticks. |
| `frontend/src/Tutorial.jsx` (new) | The tutorial screen. Owns which phase (watch or practice) is showing. |
| `frontend/src/TutorialWatch.jsx` (new) | The walkthrough: board, commentary, Back/Forward. Engine silent. |
| `frontend/src/TutorialPractice.jsx` (new) | The player executes the line against the scripted opponent. Engine on. |
| `frontend/src/Game.jsx` | Uses `useGameHistory` instead of owning the state. Stops analysing intermediate replay positions. |
| `frontend/src/StartScreen.jsx` | Renders `LearnList` below the existing settings. |
| `frontend/src/App.jsx` | One new screen value and the completed-tutorial set. |
| `frontend/src/TeachingPanel.jsx` | Reads `index`/`mark` from the props it is given rather than from `records`. |
| `backend/tests/test_tutorials.py` (new) | Proves every claim in `tutorials.json` against the solver. |

**Task order.** Task 1 is a pure refactor and must land first — Tasks 6 and 7 depend on the hook. Task 2 is independent and could run any time. Task 3 proves the content before any UI is built; Tasks 4–8 build on it in order.

---

### Task 1: Extract `useGameHistory`

Carried debt from Phase 3 (ruling R10). A **pure refactor**: no behaviour changes, no new controls, no test changes. The game must play exactly as it does today. The watch phase in Task 6 needs this navigation without the game around it.

**Files:**

- Create: `frontend/src/useGameHistory.js`
- Modify: `frontend/src/Game.jsx`

**Interfaces:**

- Consumes: `playInHistory`, `lastMoveIndex`, `moveLabels` from `game.js`.
- Produces:
  - `useGameHistory(onStep) -> { history, cursor, squares, lastMove, labels, atTip, replaying, playAt, goTo, reset }`
  - `onStep` is called once per ply actually advanced or rewound — this is where `Game.jsx` passes its pencil-scratch function.
  - `playAt(index, mark) -> void` — appends at the cursor, discarding any future.
  - `goTo(ply) -> void` — sets the replay target; the cursor walks toward it.
  - `reset() -> void` — a fresh empty board with a new array identity.

- [ ] **Step 1: Read the code being moved**

Read `frontend/src/Game.jsx` lines 37–61 (the `history`, `cursor`, `target` state and the derived `squares`, `lastMove`, `labels`, `atTip`, `replaying`), the `playAt` and `goTo` functions, the replay `useEffect`, and `startNewGame`. Everything this task moves is already there; the job is relocation, not redesign.

- [ ] **Step 2: Create the hook**

Create `frontend/src/useGameHistory.js`:

```js
import { useEffect, useState } from 'react';
import { lastMoveIndex, moveLabels, playInHistory } from './game.js';

/** Gap between plies while replaying, so a jump reads as a sequence. */
const REPLAY_STEP_MS = 180;

/**
 * The board's past, and movement through it.
 *
 * A played game and a scripted tutorial line are the same thing to this hook:
 * an array of positions and a cursor into it. That is why it is a hook rather
 * than state inside `Game` — the tutorial walkthrough needs the navigation
 * without the game around it.
 *
 * @param {(ply: number) => void} [onStep] - Called once per ply actually
 *   advanced or rewound, including each ply of a replay. Used for the pencil
 *   sound; a component with nothing to do per step can omit it.
 * @returns {{history: Array<Array<string|null>>, cursor: number,
 *   squares: Array<string|null>, lastMove: number|null,
 *   labels: string[], atTip: boolean, replaying: boolean,
 *   playAt: (index: number, mark: string) => void,
 *   goTo: (ply: number) => void, reset: () => void}}
 */
export function useGameHistory(onStep) {
  const [history, setHistory] = useState(() => [Array(9).fill(null)]);
  const [cursor, setCursor] = useState(0);
  // Where navigation is heading. The cursor walks toward it a ply at a time so
  // a jump replays the moves between instead of snapping.
  const [target, setTarget] = useState(null);

  const squares = history[cursor];
  const atTip = cursor === history.length - 1;
  const replaying = target !== null && target !== cursor;

  useEffect(() => {
    if (target === null || target === cursor) {
      return undefined;
    }
    const step = target > cursor ? 1 : -1;
    const timer = setTimeout(() => {
      onStep?.(cursor + step);
      setCursor(cursor + step);
    }, REPLAY_STEP_MS);
    return () => clearTimeout(timer);
    // `onStep` is deliberately omitted: callers pass a plain function recreated
    // every render, so listing it would make this effect depend on its own
    // render rather than on `target`/`cursor`, which are the only inputs that
    // should restart the timer.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [target, cursor]);

  function playAt(index, mark) {
    if (squares[index] !== null) {
      return;
    }
    onStep?.(cursor + 1);
    setTarget(null);
    const next = playInHistory(history, cursor, index, mark);
    setHistory(next.history);
    setCursor(next.cursor);
  }

  function goTo(ply) {
    setTarget(ply);
  }

  function reset() {
    // A fresh array, not a shared constant: identity is what re-triggers
    // useAnalysis's fetch (and re-rolls a perfect opponent's random opening),
    // and setState bails out on an identical reference.
    setHistory([Array(9).fill(null)]);
    setCursor(0);
    setTarget(null);
  }

  return {
    history,
    cursor,
    squares,
    lastMove: lastMoveIndex(history[cursor - 1], squares),
    labels: moveLabels(history),
    atTip,
    replaying,
    playAt,
    goTo,
    reset,
  };
}
```

- [ ] **Step 3: Use the hook in `Game.jsx`**

In `Game.jsx`: delete the `history`, `cursor` and `target` `useState` calls, the derived `squares`/`lastMove`/`labels`/`atTip`/`replaying`, the replay `useEffect`, and the body of `playAt`. Add the import and call the hook near the top of the component:

```js
import { useGameHistory } from './useGameHistory.js';
```

```js
  const {
    history,
    cursor,
    squares,
    lastMove,
    labels,
    atTip,
    replaying,
    playAt: playInGame,
    goTo: goToPly,
    reset: resetHistory,
  } = useGameHistory(scratch);
```

`scratch` must be declared **above** this call — move its definition up if needed. `Game` keeps two thin wrappers, because clearing the critique is game behaviour and does not belong in the hook:

```js
  function playAt(index) {
    if (over) {
      return;
    }
    playInGame(index, player);
  }

  // Every navigation goes through here so there is exactly one path, and so a
  // critique banner cannot outlive the move it describes: stepping away from
  // that move dismisses its warning rather than leaving it pointing at a
  // position no longer on screen.
  function goTo(ply) {
    setCritique(null);
    goToPly(ply);
  }
```

`startNewGame` calls `resetHistory()` in place of the three setters it used to call. `REPLAY_STEP_MS` is no longer used in `Game.jsx` — delete the constant there. Remove `playInHistory` and `lastMoveIndex` and `moveLabels` from the `game.js` import list if nothing else in the file uses them.

- [ ] **Step 4: Verify the suites and the lint are unchanged**

Run: `cd frontend && npm test && npm run lint && npx prettier --check src/`
Expected: **38 tests / 38 pass**, oxlint silent, Prettier clean. No test should have changed — this task moves code, it does not alter behaviour.

- [ ] **Step 5: Verify in the browser that nothing changed**

Start the stack (`cd backend && uv run flask --app app run --port 5000` and `cd frontend && npm run dev`), open `http://localhost:5173`, and confirm all four still work:

1. Play three moves against the fallible computer — the computer answers each time.
2. Press Back twice — the board rewinds one ply at a time, not instantly.
3. Press Forward to the tip, then New Game — the board clears.
4. Open the move list and jump to "Game start" — the jump replays.

Report what you saw for each. If any differs from today's behaviour, the refactor is wrong — fix it rather than adjusting the expectation.

- [ ] **Step 6: Ready to commit**

Report the task complete and leave the changes unstaged. Suggested message: `Extract useGameHistory from Game`

---

### Task 2: Clear the carried Phase 3 debt

Two findings deferred in ruling R10. Independent of every other task.

**Files:**

- Modify: `frontend/src/Game.jsx`
- Modify: `frontend/src/TeachingPanel.jsx`

**Interfaces:**

- Consumes: `useGameHistory` from Task 1 (`replaying`, `history`).
- Produces: `records` entries are `{ ply, judged, mistake }` — `index` and `mark` are no longer stored.

- [ ] **Step 1: Stop analysing the positions a replay passes through**

A nine-ply jump currently fires nine requests and aborts eight of them. Nothing renders those intermediate positions, so nothing needs them. In `Game.jsx`, add `!replaying` to the `enabled` argument of `useAnalysis`:

```js
  const { data, loading, error, retry } = useAnalysis(
    squares,
    isComputerTurn ? settings.difficulty : null,
    // `over` is in here because the end-of-game review needs the analysis even
    // when every teaching setting is off: it reads the result from it.
    // `!replaying` suppresses the requests for positions a jump only passes
    // through: they are never rendered, and each one was fired and aborted a
    // frame later. The destination position fetches normally, because
    // `replaying` is false again once the cursor arrives.
    (teachingOn || settings.critique || isComputerTurn || over) && !replaying,
  );
```

- [ ] **Step 2: Stop storing what the history already knows**

A record's `index` and `mark` are derivable from the two positions either side of `ply`. In `Game.jsx`, `handleCellClick` records only what cannot be derived:

```js
    setRecords((previous) => [
      ...previous.filter((record) => record.ply < cursor + 1),
      { ply: cursor + 1, judged: analysis !== null, mistake },
    ]);
```

and the props passed to `TeachingPanel` gain the derived fields, so the panel keeps rendering exactly what it renders today:

```js
                <TeachingPanel
                  analysis={analysis}
                  loading={loading}
                  error={error}
                  teaching={settings.teaching}
                  hoveredIndex={hoveredIndex}
                  onHover={setHoveredIndex}
                  vsComputer={vsComputer}
                  humanMark={humanMark}
                  records={records.map((record) => {
                    const index = lastMoveIndex(
                      history[record.ply - 1],
                      history[record.ply],
                    );
                    return { ...record, index, mark: history[record.ply][index] };
                  })}
                  onGoTo={goTo}
                />
```

`lastMoveIndex` must be in `Game.jsx`'s import list from `game.js`. `TeachingPanel.jsx` needs **no change** — it already reads `record.index` and `record.mark`.

- [ ] **Step 3: Verify the suites**

Run: `cd frontend && npm test && npm run lint && npx prettier --check src/`
Expected: **38 tests / 38 pass**, oxlint silent, Prettier clean.

- [ ] **Step 4: Verify both fixes in the browser**

With the stack running and the DevTools Network panel filtered to `analyse`:

1. Play a six-ply game against the fallible computer, then jump to "Game start" from the move list. **Count the `/api/analyse` requests fired by the jump.** Expected: **one**, for the destination. Report the number you counted.
2. In the same game, play a move that trips the slip warning, finish the game, and confirm the review still names the move correctly — `Move N: X top right` and the outcome line. This proves the derived `index`/`mark` match what was stored before.

- [ ] **Step 5: Ready to commit**

Suggested message: `Stop analysing positions a replay passes through`

---

### Task 3: The tutorial facts, proved against the solver

The content is a factual claim about tic-tac-toe. This task states the claims and proves them **before** any UI exists to display them. If a claim fails, the tutorial is wrong and the content changes — not the test.

**Files:**

- Create: `frontend/src/tutorials.json`
- Create: `backend/tests/test_tutorials.py`

**Interfaces:**

- Produces: `tutorials.json` — an array of objects with `id`, `line` (three indices: your opening, their reply, your trap), `losing`, `safe`, and `punish` (a map from each losing reply to the move that beats it). Consumed by `tutorials.js` in Task 4 and by this task's test.

- [ ] **Step 1: Write the facts**

Create `frontend/src/tutorials.json`. Cell indices are 0–8, left to right then top to bottom, matching `CELL_NAMES` in `game.js`. Every number below was read off the solver; do not adjust them to make a test pass.

```json
[
  {
    "id": "centre-first",
    "line": [4, 0, 8],
    "losing": [1, 3, 5, 7],
    "safe": [2, 6],
    "punish": { "1": 2, "3": 6, "5": 6, "7": 2 }
  },
  {
    "id": "corner-first",
    "line": [0, 4, 8],
    "losing": [2, 6],
    "safe": [1, 3, 5, 7],
    "punish": { "2": 6, "6": 2 }
  },
  {
    "id": "side-first",
    "line": [1, 0, 3],
    "losing": [2, 6, 8],
    "safe": [4, 5, 7],
    "punish": { "2": 4, "6": 4, "8": 4 }
  }
]
```

- [ ] **Step 2: Write the failing test**

Create `backend/tests/test_tutorials.py`:

```python
"""The tutorials make factual claims about tic-tac-toe. These prove them.

The claims live in `frontend/src/tutorials.json`, which the frontend also
reads, so the app cannot teach a line the solver disagrees with. A failure
here means the tutorial content is wrong, not the test.
"""

import json
from pathlib import Path
from typing import Any

import pytest

from game import Board, legal_moves, play
from rules import name_move
from solver import analyse_moves

TUTORIALS_PATH = (
    Path(__file__).resolve().parents[2] / "frontend" / "src" / "tutorials.json"
)
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
```

- [ ] **Step 3: Run the test to verify it passes**

Run: `cd backend && uv run pytest tests/test_tutorials.py -v`
Expected: **PASS**, 18 tests (5 parametrized across 3 tutorials, plus 3 standalone).

This test passes on first run, which is unusual for TDD and correct here: the JSON encodes facts already read off the solver, and the test's job is to stop them drifting. To confirm it has teeth, temporarily change `"safe": [2, 6]` to `"safe": [2, 5]` in `centre-first` and re-run — `test_the_stated_squares_are_the_real_ones` and `test_the_losing_squares_share_a_description` must both fail. **Restore the file afterwards** and re-run to confirm green.

- [ ] **Step 4: Verify the whole backend suite and the linters**

Run: `cd backend && uv run pytest -q && uv run ruff check . && uv run ruff format --check .`
Expected: **81 passed** (63 + 18), Ruff clean both ways.

- [ ] **Step 5: Ready to commit**

Suggested message: `Add tutorial facts, verified against the solver`

---

### Task 4: The tutorial module

The prose, and the pure functions the two tutorial screens need. Everything here is testable under `node --test`.

**Files:**

- Create: `frontend/src/tutorials.js`
- Modify: `frontend/src/game.test.js`

**Interfaces:**

- Consumes: `tutorials.json` from Task 3; `playInHistory`, `playedCount` from `game.js`.
- Produces:
  - `TUTORIALS` — an array of four objects: `{ id, name, summary, mark, steps, practice, rules }`. `steps` is `[{ board, note }]`. `practice` is `{ replies, goal }` or `null`. `rules` is a string array or `null`.
  - `findTutorial(id) -> object | undefined`
  - `scriptedReply(board, replies) -> number` — the opponent's move, or `-1` if the board is full.
  - `expectedMove(board, tutorial) -> number | null` — the move the line calls for, or `null` when the player is off it.

- [ ] **Step 1: Write the failing tests**

Append to `frontend/src/game.test.js`. Add a new import line at the top of the file (leave the existing `./game.js` import alone):

```js
import {
  TUTORIALS,
  findTutorial,
  scriptedReply,
  expectedMove,
} from './tutorials.js';
```

```js
test('every tutorial has a name, a summary and a mark', () => {
  assert.equal(TUTORIALS.length, 4);
  for (const tutorial of TUTORIALS) {
    assert.ok(tutorial.name.length > 0, tutorial.id);
    assert.ok(tutorial.summary.length > 0, tutorial.id);
    assert.ok(['X', 'O'].includes(tutorial.mark), tutorial.id);
  }
});

test('the three attacking tutorials walk through their line', () => {
  const attacking = TUTORIALS.filter((tutorial) => tutorial.practice);
  assert.equal(attacking.length, 3);
  for (const tutorial of attacking) {
    // Empty board, then one position per scripted move.
    assert.equal(tutorial.steps.length, 4, tutorial.id);
    assert.equal(tutorial.steps[0].board.filter(Boolean).length, 0);
    assert.equal(tutorial.steps[3].board.filter(Boolean).length, 3);
    for (const step of tutorial.steps) {
      assert.ok(step.note.length > 0, tutorial.id);
    }
  }
});

test('the defending tutorial has rules and no practice', () => {
  const going = findTutorial('going-second');
  assert.equal(going.practice, null);
  assert.equal(going.steps.length, 0);
  assert.equal(going.rules.length, 4);
});

test('the scripted opponent plays its replies in order', () => {
  const board = Array(9).fill(null);
  board[4] = 'X';
  // centre-first scripts [0, 1]: the sound corner, then a losing side.
  assert.equal(scriptedReply(board, [0, 1]), 0);
  board[0] = 'O';
  board[8] = 'X';
  assert.equal(scriptedReply(board, [0, 1]), 1);
});

test('the scripted opponent skips a reply the player has taken', () => {
  const board = Array(9).fill(null);
  board[0] = 'X';
  assert.equal(scriptedReply(board, [0, 1]), 1);
});

test('the scripted opponent falls back to any free cell', () => {
  const board = Array(9).fill('X');
  board[5] = null;
  assert.equal(scriptedReply(board, [0, 1]), 5);
  assert.equal(scriptedReply(Array(9).fill('X'), [0, 1]), -1);
});

test('the expected move follows the line, then the punish', () => {
  const centre = findTutorial('centre-first');
  const board = Array(9).fill(null);
  assert.equal(expectedMove(board, centre), 4);

  board[4] = 'X';
  board[0] = 'O';
  assert.equal(expectedMove(board, centre), 8);

  board[8] = 'X';
  board[1] = 'O';                       // they fall for it with a side
  assert.equal(expectedMove(board, centre), 2);
});

test('there is no expected move once the player leaves the line', () => {
  const centre = findTutorial('centre-first');
  const board = Array(9).fill(null);
  board[4] = 'X';
  board[0] = 'O';
  board[5] = 'X';                       // not the opposite corner
  board[2] = 'O';                       // not a square the punish table covers
  assert.equal(expectedMove(board, centre), null);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && npm test`
Expected: FAIL — `Cannot find module './tutorials.js'`.

- [ ] **Step 3: Write the module**

Create `frontend/src/tutorials.js`. The prose below is the tutorial content; keep it verbatim.

```js
import facts from './tutorials.json';
import { playedCount, playInHistory } from './game.js';

/**
 * Replay a tutorial's line into one position per move.
 *
 * @param {number[]} line - Cell indices, played alternately starting with X.
 * @returns {Array<Array<string|null>>} The empty board, then one position per
 *   move in the line.
 */
function positions(line) {
  let state = { history: [Array(9).fill(null)], cursor: 0 };
  line.forEach((index, ply) => {
    state = playInHistory(state.history, state.cursor, index, ply % 2 ? 'O' : 'X');
  });
  return state.history;
}

/**
 * Pair each position in a line with the commentary for reaching it.
 *
 * @param {number[]} line - The tutorial's three scripted moves.
 * @param {string[]} notes - One note per position, including the empty board.
 * @returns {Array<{board: Array<string|null>, note: string}>} The steps.
 */
function steps(line, notes) {
  return positions(line).map((board, ply) => ({ board, note: notes[ply] }));
}

const NOTES = {
  'centre-first': [
    'You take the centre. It sits on four of the eight lines, more than any other square.',
    'They answer with a corner. It is their only reply that does not lose outright — so far they have played well.',
    'You take the corner opposite theirs. Nothing threatens anything: no two of your marks share a line, so there is nothing for them to block.',
    'And that is the trap. Four of their six replies now lose. Every side loses; only the two remaining corners survive. A player scanning for a block sees nothing to do and picks a square that feels harmless.',
  ],
  'corner-first': [
    'You take a corner.',
    'They answer with the centre — again their only reply that does not lose.',
    'You take the corner opposite your first. Two of your marks on one diagonal, with their mark between: no threat, nothing to block.',
    'Now the mirror of the last lesson. Two of their six replies lose, and this time it is the corners that kill them. A corner saved them a moment ago and loses for them here — which is why a habit cannot rescue them.',
  ],
  'side-first': [
    'You open on a side. It looks like the weakest square on the board, which is part of why this works.',
    'They answer with a corner touching your side — a sound reply.',
    'You take the side perpendicular to your first, wrapping an L around their corner. Your two marks do not share a line, so once again there is nothing to block.',
    'Three of their six replies lose, and every one of them is a corner — the square novices reach for. Whichever corner they take, your answer is the same one: the centre.',
  ],
};

const PRACTICE = {
  'centre-first': {
    replies: [0, 1],
    goal: 'Open in the centre, set the trap, and punish the side they play.',
  },
  'corner-first': {
    replies: [4, 2],
    goal: 'Open in a corner, set the trap, and punish the corner they play.',
  },
  'side-first': {
    replies: [0, 2],
    goal: 'Open on a side, wrap the L, and punish the corner they play.',
  },
};

const NAMES = {
  'centre-first': 'Centre first',
  'corner-first': 'Corner first',
  'side-first': 'Side first',
};

const SUMMARIES = {
  'centre-first': 'The deadliest trap: four of their six replies lose.',
  'corner-first': 'The mirror image — here it is the corners that kill them.',
  'side-first': 'The weakest-looking opening, and the punish is always the same square.',
};

/**
 * The four tutorials, in teaching order.
 *
 * The three attacking tutorials are built from `tutorials.json`, which a
 * backend test proves against the solver — so the prose here can never claim
 * something the engine disagrees with without that test failing.
 */
export const TUTORIALS = [
  ...facts.map((fact) => ({
    id: fact.id,
    name: NAMES[fact.id],
    summary: SUMMARIES[fact.id],
    mark: 'X',
    line: fact.line,
    punish: fact.punish,
    steps: steps(fact.line, NOTES[fact.id]),
    practice: PRACTICE[fact.id],
    rules: null,
  })),
  {
    id: 'going-second',
    name: 'Going second',
    summary: 'You cannot win. Here is how not to lose.',
    mark: 'O',
    line: [],
    punish: {},
    steps: [],
    practice: null,
    rules: [
      'If they take a corner, take the middle or lose. The centre is the only square that does not lose.',
      'If they take the middle, take a corner or lose. Any of the four will do.',
      'Then watch for the traps in the first three lessons — the only positions where nothing needs blocking and you can still lose.',
      'Follow the first two rules and the draw is always there. You can still throw it later; these only get you past the opening.',
    ],
  },
];

/**
 * Look a tutorial up by its id.
 *
 * @param {string} id - The tutorial's id.
 * @returns {object|undefined} The tutorial, or undefined if there is no such id.
 */
export function findTutorial(id) {
  return TUTORIALS.find((tutorial) => tutorial.id === id);
}

/**
 * The scripted opponent's move.
 *
 * It plays the first reply in its list that is still free. A reply the player
 * has taken is skipped rather than retried, and once the list is used up any
 * free cell will do: by then the player has forked, so every reply loses.
 *
 * @param {Array<string|null>} board - The position to move in.
 * @param {number[]} replies - The scripted replies, in order.
 * @returns {number} The cell to play, or -1 if the board is full.
 */
export function scriptedReply(board, replies) {
  const next = replies.find((index) => board[index] === null);
  return next ?? board.findIndex((cell) => cell === null);
}

/**
 * The move the tutorial's line calls for in this position.
 *
 * @param {Array<string|null>} board - The position the player is looking at.
 * @param {object} tutorial - The tutorial being practised.
 * @returns {number|null} The expected cell, or null if the player has left the
 *   line and there is nothing to expect.
 */
export function expectedMove(board, tutorial) {
  const played = playedCount(board);
  if (played === 0) {
    return tutorial.line[0] ?? null;
  }
  if (played === 2) {
    return board[tutorial.line[0]] === 'X' ? tutorial.line[2] : null;
  }
  if (played === 4) {
    const theirs = board.findIndex(
      (cell, index) => cell === 'O' && index !== tutorial.line[1],
    );
    return tutorial.punish[String(theirs)] ?? null;
  }
  return null;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd frontend && npm test && npm run lint && npx prettier --check src/`
Expected: **46 tests / 46 pass** (38 + 8), oxlint silent, Prettier clean.

If `node --test` cannot import the JSON, add `with { type: 'json' }` to the import in `tutorials.js` and report that you did — Vite accepts both forms.

- [ ] **Step 5: Ready to commit**

Suggested message: `Add tutorial content and scripted opponent`

---

### Task 5: The Learn section

Four tutorials listed on the start screen, and the routing to reach one.

**Files:**

- Create: `frontend/src/LearnList.jsx`
- Modify: `frontend/src/StartScreen.jsx`
- Modify: `frontend/src/App.jsx`

**Interfaces:**

- Consumes: `TUTORIALS` from Task 4.
- Produces:
  - `App` holds `screen` of `'start' | 'game' | 'tutorial'` and `tutorialId`; `completed` is a `string[]` persisted at `tictactoogood:completed`.
  - `<LearnList completed={string[]} onOpen={(id) => void} />`

- [ ] **Step 1: Write the list component**

Create `frontend/src/LearnList.jsx`:

```js
import { TUTORIALS } from './tutorials.js';

/**
 * The Learn section: the tutorials, by name, with what each one is for.
 *
 * A tutorial is not an opponent, so this is its own section rather than a
 * fourth entry in the "Who are you playing?" group.
 */
export default function LearnList({ completed, onOpen }) {
  return (
    <section className="mt-4">
      <h2 className="fs-6 text-body-secondary">Learn</h2>
      <div className="list-group">
        {TUTORIALS.map((tutorial) => {
          const done = completed.includes(tutorial.id);
          return (
            <button
              key={tutorial.id}
              type="button"
              className="list-group-item list-group-item-action"
              onClick={() => onOpen(tutorial.id)}
            >
              <div className="d-flex justify-content-between align-items-center gap-2">
                <strong>{tutorial.name}</strong>
                {/* The word carries the meaning, not the tick: a glyph alone
                    would leave the state unavailable to a screen reader. */}
                {done && (
                  <span className="badge text-bg-success">✓ Done</span>
                )}
              </div>
              <small className="text-body-secondary">{tutorial.summary}</small>
            </button>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Render it from the start screen**

In `StartScreen.jsx`, add the import and accept two new props:

```js
import LearnList from './LearnList.jsx';
```

Change the signature to `function StartScreen({ settings, onChange, onStart, completed, onOpenTutorial })` and render the list immediately after the closing `</div>` of the `d-inline-block text-start` block, before the Start game button's `<div>`:

```jsx
      <div className="d-inline-block text-start w-100" style={{ maxWidth: '32rem' }}>
        <LearnList completed={completed} onOpen={onOpenTutorial} />
      </div>
```

- [ ] **Step 3: Add the screen and the completed set to `App.jsx`**

Add a storage key beside the existing two, and a reader that tolerates a corrupt or absent value:

```js
const COMPLETED_KEY = 'tictactoogood:completed';
```

```js
/** Which tutorials have been finished. Storage can throw or hold something
 *  that is not an array, so anything unexpected reads as "none finished"
 *  rather than taking the app down. */
function storedCompleted() {
  try {
    const parsed = JSON.parse(localStorage.getItem(COMPLETED_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
```

In the component, add state and a recorder that writes on change rather than in an effect — the same reasoning as `changeMuted`:

```js
  const [tutorialId, setTutorialId] = useState(null);
  const [completed, setCompleted] = useState(storedCompleted);

  function markCompleted(id) {
    setCompleted((previous) => {
      if (previous.includes(id)) {
        return previous;
      }
      const next = [...previous, id];
      try {
        localStorage.setItem(COMPLETED_KEY, JSON.stringify(next));
      } catch {
        // Not remembered; not fatal.
      }
      return next;
    });
  }
```

Pass the new props to `StartScreen`:

```jsx
        <StartScreen
          settings={settings}
          onChange={setSettings}
          onStart={() => setScreen('game')}
          completed={completed}
          onOpenTutorial={(id) => {
            setTutorialId(id);
            setScreen('tutorial');
          }}
        />
```

and add the third branch. `Tutorial` does not exist until Task 6, so for this task render a placeholder that proves the routing works:

```jsx
      ) : screen === 'tutorial' ? (
        <div className="text-center">
          <p>Tutorial: {tutorialId}</p>
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => setScreen('start')}
          >
            Back to menu
          </button>
        </div>
      ) : (
```

- [ ] **Step 4: Verify the suites**

Run: `cd frontend && npm test && npm run lint && npx prettier --check src/`
Expected: **46 tests / 46 pass**, oxlint silent, Prettier clean.

- [ ] **Step 5: Verify in the browser**

With the stack running:

1. The start screen shows a **Learn** heading and four rows: Centre first, Corner first, Side first, Going second, each with its summary.
2. Clicking a row shows the placeholder with that tutorial's id; "Back to menu" returns.
3. In DevTools, run `localStorage.setItem('tictactoogood:completed', '["centre-first"]')` and reload — Centre first shows a **✓ Done** badge and the others do not.
4. Run `localStorage.setItem('tictactoogood:completed', 'not json')` and reload — the app still renders, with no badges.

Report what you saw for each.

- [ ] **Step 6: Ready to commit**

Suggested message: `Add the Learn section and tutorial routing`

---

### Task 6: The watch phase

The walkthrough: board, commentary, Back and Forward. This is the first consumer of `useGameHistory` other than the game.

**Files:**

- Create: `frontend/src/TutorialWatch.jsx`
- Create: `frontend/src/Tutorial.jsx`
- Modify: `frontend/src/App.jsx`

**Interfaces:**

- Consumes: `findTutorial` from Task 4; `Board` from `Board.jsx`; `useGameHistory` from Task 1.
- Produces:
  - `<Tutorial id={string} muted={boolean} completed={string[]} onComplete={(id) => void} onQuit={() => void} />`
  - `<TutorialWatch tutorial={object} muted={boolean} onFinish={() => void} />`

- [ ] **Step 1: Write the watch component**

Create `frontend/src/TutorialWatch.jsx`. It does not use `useGameHistory` for its cursor, because a tutorial's positions are a fixed array rather than a history that grows — a plain index is the whole state. It reuses the `Board` component with every teaching prop left off, which is what makes the engine silent.

```js
import { useState } from 'react';
import Board from './Board.jsx';
import { lastMoveIndex } from './game.js';
import { playPencil } from './sound.js';

/**
 * The walkthrough. One scripted position at a time, with the commentary for
 * reaching it.
 *
 * `Board` is rendered with no `moves` and `teaching="off"`, so no star, tint or
 * verdict appears. That is deliberate rather than incidental: the solver rates
 * a square by what perfect play does next, and these lessons are about what a
 * person does next, so its annotations would contradict the commentary.
 */
export default function TutorialWatch({ tutorial, muted, onFinish }) {
  const [step, setStep] = useState(0);
  const current = tutorial.steps[step];
  const last = step === tutorial.steps.length - 1;

  function go(next) {
    if (!muted) {
      playPencil();
    }
    setStep(next);
  }

  return (
    <div className="text-center">
      <Board
        squares={current.board}
        winningLine={null}
        lastMove={lastMoveIndex(tutorial.steps[step - 1]?.board, current.board)}
        disabled
        onPlay={() => {}}
        teaching="off"
      />
      <div className="message-slot mx-auto mt-3 text-start">
        <p aria-live="polite">{current.note}</p>
      </div>
      <div className="d-flex justify-content-center gap-2">
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          onClick={() => go(step - 1)}
          disabled={step === 0}
        >
          ← Back
        </button>
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          onClick={() => go(step + 1)}
          disabled={last}
        >
          Forward →
        </button>
      </div>
      {last && (
        <button type="button" className="btn btn-primary mt-4" onClick={onFinish}>
          Now you try
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write the tutorial screen**

Create `frontend/src/Tutorial.jsx`. The practice phase does not exist until Task 7, so this task wires the watch phase and leaves a marked gap:

```js
import { useState } from 'react';
import TutorialWatch from './TutorialWatch.jsx';
import { findTutorial } from './tutorials.js';

/**
 * One tutorial, in two phases: watch the line, then play it.
 *
 * "Going second" has no line to play, so it shows its rules and finishes there.
 */
export default function Tutorial({ id, muted, onComplete, onQuit }) {
  const tutorial = findTutorial(id);
  const [phase, setPhase] = useState('watch');

  if (!tutorial) {
    return (
      <div className="text-center">
        <p>That tutorial does not exist.</p>
        <button type="button" className="btn btn-primary" onClick={onQuit}>
          Back to menu
        </button>
      </div>
    );
  }

  return (
    <div className="text-center">
      <h1 className="mb-1">{tutorial.name}</h1>
      <p className="text-body-secondary small mb-4">{tutorial.summary}</p>

      {tutorial.rules ? (
        <div className="mx-auto text-start" style={{ maxWidth: '40rem' }}>
          <ol className="list-group list-group-numbered">
            {tutorial.rules.map((rule) => (
              <li key={rule} className="list-group-item">
                {rule}
              </li>
            ))}
          </ol>
          <p className="text-body-secondary mt-3">
            Want to see it for yourself? Start a game, set{' '}
            <strong>Computer plays</strong> to <strong>X</strong> with the{' '}
            <strong>perfect</strong> opponent and teaching on{' '}
            <strong>Every move</strong>, then break rule 1 on purpose and watch
            every square turn red.
          </p>
          <button
            type="button"
            className="btn btn-primary mt-2"
            onClick={() => onComplete(tutorial.id)}
          >
            Got it
          </button>
        </div>
      ) : phase === 'watch' ? (
        <TutorialWatch
          tutorial={tutorial}
          muted={muted}
          onFinish={() => setPhase('practice')}
        />
      ) : (
        <p>Practice arrives in Task 7.</p>
      )}

      <div className="mt-4">
        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={onQuit}
        >
          Back to menu
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Replace the placeholder in `App.jsx`**

Add the import and swap the Task 5 placeholder branch for the real screen:

```js
import Tutorial from './Tutorial.jsx';
```

```jsx
      ) : screen === 'tutorial' ? (
        <Tutorial
          id={tutorialId}
          muted={muted}
          onComplete={(id) => {
            markCompleted(id);
            setScreen('start');
          }}
          onQuit={() => setScreen('start')}
        />
      ) : (
```

- [ ] **Step 4: Verify the suites**

Run: `cd frontend && npm test && npm run lint && npx prettier --check src/`
Expected: **46 tests / 46 pass**, oxlint silent, Prettier clean.

- [ ] **Step 5: Verify in the browser**

1. Open **Centre first**. Step Forward through all four positions and confirm the board fills in the order centre, top-left, bottom-right, and that the commentary changes each time.
2. **Count the stars and tints on the board at every step.** Expected: **zero** at all four, with the teaching dial irrelevant — set it to "Every move" on the start screen first, then open the tutorial and confirm it is still zero. Report the counts.
3. Back is disabled on the first step; Forward is disabled on the last; "Now you try" appears only on the last.
4. Open **Going second**. It shows four numbered rules and the perfect-computer exercise, with no board. "Got it" returns to the menu and the row now shows ✓ Done.
5. Confirm no console errors.

- [ ] **Step 6: Ready to commit**

Suggested message: `Add the tutorial walkthrough`

---

### Task 7: The practice phase

The player executes the line from an empty board against an opponent scripted to fall for it.

**Files:**

- Create: `frontend/src/TutorialPractice.jsx`
- Modify: `frontend/src/Tutorial.jsx`

**Interfaces:**

- Consumes: `useGameHistory` from Task 1; `scriptedReply`, `expectedMove` from Task 4; `Board`; `calculateWinner`, `isOver`, `nextPlayer`, `CELL_NAMES` from `game.js`.
- Produces: `<TutorialPractice tutorial={object} muted={boolean} onWin={() => void} />`

- [ ] **Step 1: Write the practice component**

Create `frontend/src/TutorialPractice.jsx`:

```js
import { useEffect, useState } from 'react';
import Board from './Board.jsx';
import { useGameHistory } from './useGameHistory.js';
import { scriptedReply, expectedMove } from './tutorials.js';
import { CELL_NAMES, calculateWinner, isOver, nextPlayer } from './game.js';
import { playPencil } from './sound.js';

/** How long the opponent appears to think, matching the game screen. */
const THINKING_MS = 400;

/**
 * The player runs the line themselves.
 *
 * The opponent is scripted rather than played. Against the honest fallible
 * opponent this trap springs between 31% and 69% of the time depending on the
 * lesson, so most attempts would end in a quiet draw having demonstrated
 * nothing. The real odds belong in the game that unlocks afterwards, not here.
 */
export default function TutorialPractice({ tutorial, muted, onWin }) {
  const [hint, setHint] = useState(null);
  const { squares, lastMove, playAt, reset } = useGameHistory(() => {
    if (!muted) {
      playPencil();
    }
  });

  const winner = calculateWinner(squares);
  const over = isOver(squares);
  const player = nextPlayer(squares);
  const theirTurn = !over && player !== tutorial.mark;
  const won = winner?.player === tutorial.mark;

  useEffect(() => {
    if (!theirTurn) {
      return undefined;
    }
    const timer = setTimeout(() => {
      const index = scriptedReply(squares, tutorial.practice.replies);
      if (index >= 0) {
        playAt(index, player);
      }
    }, THINKING_MS);
    return () => clearTimeout(timer);
    // `playAt` is recreated every render; listing it would restart the timer on
    // every render rather than only when the turn changes.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [theirTurn, squares]);

  useEffect(() => {
    if (won) {
      onWin();
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [won]);

  function handleCellClick(index) {
    if (over || theirTurn || squares[index] !== null) {
      return;
    }
    const wanted = expectedMove(squares, tutorial);
    // The hint names the move rather than refusing the click: being told what
    // the line wanted teaches more than a square that will not accept a press,
    // and the player can always start over.
    setHint(
      wanted !== null && wanted !== index
        ? `The line goes ${CELL_NAMES[wanted]} here. Play on, or start over.`
        : null,
    );
    playAt(index, tutorial.mark);
  }

  let status;
  if (won) {
    status = 'That is the trap, exactly as taught.';
  } else if (over) {
    status = 'Not this time — start over and follow the line.';
  } else if (theirTurn) {
    status = 'They answer…';
  } else {
    status = tutorial.practice.goal;
  }

  return (
    <div className="text-center">
      <p className="fs-5" aria-live="polite">
        {status}
      </p>
      <Board
        squares={squares}
        winningLine={winner?.line}
        lastMove={lastMove}
        disabled={over || theirTurn}
        onPlay={handleCellClick}
        teaching="off"
      />
      <div className="message-slot mx-auto mt-3">
        {hint && !won && (
          <div className="alert alert-warning text-start" role="alert">
            {hint}
          </div>
        )}
        {won && (
          <div className="alert alert-success text-start" role="alert">
            Done. This worked every time because the opponent was scripted to
            walk into it — against a real player it will not.
          </div>
        )}
      </div>
      <button
        type="button"
        className="btn btn-outline-secondary btn-sm"
        onClick={() => {
          setHint(null);
          reset();
        }}
      >
        Start over
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Wire it into the tutorial screen**

In `Tutorial.jsx`, add the import and replace the Task 6 placeholder:

```js
import TutorialPractice from './TutorialPractice.jsx';
```

```jsx
      ) : (
        <TutorialPractice
          tutorial={tutorial}
          muted={muted}
          onWin={() => onComplete(tutorial.id)}
        />
      )}
```

`onComplete` currently returns to the start screen, which would snatch the board away the moment the player wins. Change `Tutorial` to record completion without navigating, and let the player leave when they choose — replace the `onComplete` prop usage in the practice branch with a local handler:

```jsx
        <TutorialPractice
          tutorial={tutorial}
          muted={muted}
          onWin={() => onComplete(tutorial.id, { stay: true })}
        />
```

and in `App.jsx`:

```jsx
          onComplete={(id, options) => {
            markCompleted(id);
            if (!options?.stay) {
              setScreen('start');
            }
          }}
```

- [ ] **Step 3: Verify the suites**

Run: `cd frontend && npm test && npm run lint && npx prettier --check src/`
Expected: **46 tests / 46 pass**, oxlint silent, Prettier clean.

- [ ] **Step 4: Verify in the browser**

For **Centre first**, play the line: centre, then bottom-right after they take top-left, then top-right after they take top-centre.

1. The opponent plays **top left** then **top centre**, matching the script.
2. Your third move wins — the win line draws and the success alert appears.
3. **The board shows no stars or tints at any point.** Report the counts.
4. Start over, then deliberately play a side as your second move. The hint reads "The line goes bottom right here." and the move is still accepted.
5. Repeat the happy path for **Corner first** (corner, opposite corner, then bottom-left) and **Side first** (top-centre, middle-left, then centre) and confirm each wins.
6. Confirm no console errors.

- [ ] **Step 5: Ready to commit**

Suggested message: `Add the tutorial practice phase`

---

### Task 8: The unlock

Completing a tutorial reveals the same strategy against the honest opponent.

**Files:**

- Modify: `frontend/src/Tutorial.jsx`
- Modify: `frontend/src/App.jsx`

**Interfaces:**

- Consumes: `completed` from `App`.
- Produces: `Tutorial` takes `completed` and `onPlayForReal`; `App` starts a fallible game with the computer on the opposing mark.

- [ ] **Step 1: Offer the real game once the tutorial is done**

In `Tutorial.jsx`, accept `completed` and `onPlayForReal`, and render the offer below the practice board when this tutorial's id is in `completed`:

```jsx
      {completed.includes(tutorial.id) && tutorial.practice && (
        <div className="mt-4">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onPlayForReal(tutorial.mark)}
          >
            Now try it against a fallible computer
          </button>
          <p className="text-body-secondary small mt-2 mb-0">
            It falls for Centre first about two times in three, and for Side
            first about one in three. That is the honest rate.
          </p>
        </div>
      )}
```

- [ ] **Step 2: Start the real game from `App.jsx`**

Pass the two new props. The computer takes the mark the player did not:

```jsx
        <Tutorial
          id={tutorialId}
          muted={muted}
          completed={completed}
          onComplete={(id, options) => {
            markCompleted(id);
            if (!options?.stay) {
              setScreen('start');
            }
          }}
          onPlayForReal={(playerMark) => {
            setSettings((previous) => ({
              ...previous,
              computerMark: playerMark === 'X' ? 'O' : 'X',
              difficulty: 'fallible',
            }));
            setScreen('game');
          }}
          onQuit={() => setScreen('start')}
        />
```

- [ ] **Step 3: Verify the suites**

Run: `cd frontend && npm test && npm run lint && npx prettier --check src/`
Expected: **46 tests / 46 pass**, oxlint silent, Prettier clean.

- [ ] **Step 4: Verify the whole phase in the browser**

1. Clear storage (`localStorage.clear()`) and reload. No tutorial shows ✓ Done, and no unlock button is offered.
2. Complete **Centre first**'s practice. The unlock button appears with the honest-rate note, and the Learn row shows ✓ Done after returning to the menu.
3. Press the unlock button. A game starts with the mode line reading **"vs Computer — fallible · you are X"**, an empty board, and your turn.
4. Reload the page and open Centre first again — ✓ Done persisted, and the unlock is offered without replaying the practice.

- [ ] **Step 5: Run the full check across both suites**

Run, and report every number:

```bash
cd frontend && npm test && npm run lint && npx prettier --check src/ && npm run build
cd backend && uv run pytest -q && uv run ruff check . && uv run ruff format --check .
```

Expected: **46 frontend tests**, **81 backend tests**, all linters silent, build clean.

- [ ] **Step 6: Run Lighthouse on the new screens**

With a tutorial's watch phase on screen, run a Lighthouse snapshot audit in **both** themes. Expected: **Accessibility 100, Best Practices 100** in each. The pre-existing SEO (60) and Agentic Browsing (50) scores are unrelated to this phase and must not be chased. Report all four numbers per theme.

- [ ] **Step 7: Ready to commit**

Suggested message: `Unlock the real opponent after a tutorial`

---

## Self-review

**Spec coverage.** Learn section → Task 5. Four tutorials → Tasks 3 and 4. Watch phase, engine silent → Task 6. Practice with scripted opponent → Task 7. Unlock → Task 8. Completion in `localStorage` → Task 5. `useGameHistory` → Task 1. The two Phase 3 findings → Task 2. No backend production change → constrained globally; the only backend file added is a test. Fixed orientation per tutorial → inherent in `tutorials.json` holding one line each.

**One spec deviation, deliberate.** The spec describes the watch phase as being driven by `useGameHistory`. Task 6 uses a plain `useState` index instead: a tutorial's positions are a fixed array that never grows or branches, so the hook's history, branching and replay-target machinery would all sit unused. `useGameHistory` still earns its extraction — Task 7's practice phase is a real second caller. If the walkthrough later needs animated jumps between steps, switch it then.

**Interfaces.** `playAt(index, mark)` takes a mark in every caller, including `Game.jsx`'s wrapper (Task 1) and `TutorialPractice` (Task 7). `onComplete(id, options)` takes the options argument from Task 7 onward, and Task 8's `App.jsx` snippet matches. `scriptedReply` returns `-1` on a full board and `TutorialPractice` guards on `index >= 0`.
