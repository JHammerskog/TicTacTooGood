# Phase 2b: Teaching UI and Computer Opponent — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Phase 2a solver into something the player can see and play against — a start screen, a computer opponent with two difficulties, and the engine's verdict rendered onto the board and a side panel.

**Architecture:** A new `backend/opponent.py` picks the computer's move and is exposed through two optional fields on the existing `POST /api/analyse` — no new route and no extra round-trip. The frontend gains a screen shell (`App` → `StartScreen` | `Game`), a `useAnalysis` custom hook wrapping the fetch, and a `TeachingPanel` beside the board. Turn derivation moves out of `App.jsx` into `game.js`.

**Tech Stack:** Python 3.14, Flask, Pydantic v2, pytest, Ruff, uv. React 19, Vite, Bootstrap 5, oxlint, Prettier, `node --test`.

**Spec:** `docs/superpowers/specs/2026-08-25-phase2b-teaching-ui-design.md`

## Global Constraints

- **Never run git commands that write state** (`add`, `commit`, `branch`, `push`). Every task ends with changes left unstaged for the user to review and commit themselves — do not run `git add`/`git commit` even though the task template would normally end that way.
- **Python:** type hints on every function; triple-quoted docstrings with Args/Returns on every function; imports grouped standard library / third-party / local. Ruff line-length 100, rules `E`, `F`, `I`.
- **JavaScript:** ES6+, semicolons required, Prettier defaults (2-space indent). JSDoc on exported functions in `game.js`, matching the existing style there.
- **Styling:** Bootstrap 5 utilities first; custom CSS only for what Bootstrap does not cover, in `frontend/src/index.css`, reusing the `var(--bs-*)` tokens already used there.
- **Accessibility:** colour is never the only channel for meaning; every annotated cell carries its verdict in `aria-label`; interactive rows are keyboard-reachable.
- **Tests:** test behaviour through a module's public API, not internals. Backend `cd backend && uv run pytest`. Frontend `cd frontend && npm test`. Lint `cd frontend && npm run lint`.
- **No new frontend dependencies.** `AbortController` is a platform API. No component test framework is added in this phase.
- **Board convention** (unchanged): 9 cells, `"X"` / `"O"` / `null`, left-to-right then top-to-bottom.

## File Structure

**Backend**

| File | Responsibility |
|---|---|
| `backend/opponent.py` (new) | Picks the computer's move. Sits above `solver` and `rules`, uses both. |
| `backend/schemas.py` | Gains `opponent` on the request, `suggested` on the response. |
| `backend/app.py` | Calls `opponent.choose`; `/api/hello` and the CORS setup are deleted. |
| `backend/tests/conftest.py` | Gains `reachable_positions()` and `immediate_wins()`. |
| `backend/tests/test_opponent.py` (new) | The exhaustive policy invariants. |
| `backend/tests/test_api.py` | Gains `suggested` cases; loses the hello test. |
| `backend/pyproject.toml` | `flask-cors` removed. |

**Frontend**

| File | Responsibility |
|---|---|
| `frontend/src/game.js` | Pure rules. Gains turn derivation and `CELL_NAMES`. |
| `frontend/src/App.jsx` | Screen routing and the `settings` object. Nothing else. |
| `frontend/src/StartScreen.jsx` (new) | Opponent and teaching choices; Start. |
| `frontend/src/Game.jsx` (new) | Board state, the computer's turn, in-game controls. |
| `frontend/src/useAnalysis.js` (new) | The fetch hook: data, loading, error, retry, abort. |
| `frontend/src/TeachingPanel.jsx` (new) | The words: grouped rows, loading, error. |
| `frontend/src/Board.jsx` | Gains annotation tints, the star, and the hover link. |
| `frontend/src/index.css` | Annotation tints and star styling. |
| `frontend/vite.config.js` | `/api` dev proxy. |
| `docker-compose.yml` | `VITE_API_TARGET` for the frontend service. |

**Task order.** Tasks 1–4 are backend and configuration and can be verified without a browser. Tasks 5–8 build the UI in layers, each one adding a control that works the moment it appears — no task leaves a visibly dead button on screen.

---

### Task 1: Move turn derivation into `game.js`

Phase 1 left `played`, `isDraw`, `isOver` and `nextPlayer` inline in `App.jsx` with a comment marking this as the first step of Phase 2. They move to `game.js`, where they are testable and where `Game.jsx` can reach them.

**Files:**
- Modify: `frontend/src/game.js`
- Modify: `frontend/src/App.jsx:13-21`
- Test: `frontend/src/game.test.js`

**Interfaces:**
- Consumes: `calculateWinner(squares)`, already in `game.js`.
- Produces:
  - `playedCount(squares) -> number`
  - `nextPlayer(squares) -> 'X' | 'O'`
  - `isDraw(squares) -> boolean`
  - `isOver(squares) -> boolean`

- [ ] **Step 1: Write the failing tests**

Append to `frontend/src/game.test.js`. The `board` helper already exists at the top of that file; do not redefine it.

```js
import {
  calculateWinner,
  playedCount,
  nextPlayer,
  isDraw,
  isOver,
} from './game.js';

test('counts the squares already played', () => {
  assert.equal(playedCount(board('.........')), 0);
  assert.equal(playedCount(board('XX.OO....')), 4);
  assert.equal(playedCount(board('XXOOOXXOX')), 9);
});

test('X plays first and the players alternate', () => {
  assert.equal(nextPlayer(board('.........')), 'X');
  assert.equal(nextPlayer(board('X........')), 'O');
  assert.equal(nextPlayer(board('XO.......')), 'X');
});

test('a full board with no winner is a draw', () => {
  assert.equal(isDraw(board('XXOOOXXOX')), true);
  assert.equal(isDraw(board('XX.OO....')), false);
});

test('a full board that someone won is not a draw', () => {
  assert.equal(isDraw(board('XXXOOXOXO')), false);
});

test('a game is over when it is won or drawn, not before', () => {
  assert.equal(isOver(board('.........')), false);
  assert.equal(isOver(board('XX.OO....')), false);
  assert.equal(isOver(board('XXX.O.O..')), true);
  assert.equal(isOver(board('XXOOOXXOX')), true);
});
```

Replace the existing `import { calculateWinner } from './game.js';` line with the multi-name import above rather than adding a second import statement.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && npm test`
Expected: FAIL — `playedCount is not a function` (or a SyntaxError about the missing export, depending on Node version).

- [ ] **Step 3: Write the implementation**

Append to `frontend/src/game.js`:

```js
/**
 * Counts the squares already played.
 *
 * @param {Array<'X' | 'O' | null>} squares - 9 cells.
 * @returns {number} How many cells hold a mark.
 */
export function playedCount(squares) {
  return squares.filter((square) => square !== null).length;
}

/**
 * Whose turn it is. X moves first, so the parity of the moves played
 * decides it — the board records marks, not their order, but it does not
 * need to.
 *
 * @param {Array<'X' | 'O' | null>} squares - 9 cells.
 * @returns {'X' | 'O'} The player to move.
 */
export function nextPlayer(squares) {
  return playedCount(squares) % 2 === 0 ? 'X' : 'O';
}

/**
 * Whether the game ended with no winner.
 *
 * @param {Array<'X' | 'O' | null>} squares - 9 cells.
 * @returns {boolean} True when the board is full and nobody won.
 */
export function isDraw(squares) {
  return !calculateWinner(squares) && playedCount(squares) === squares.length;
}

/**
 * Whether the game has finished, either way.
 *
 * @param {Array<'X' | 'O' | null>} squares - 9 cells.
 * @returns {boolean} True when the game is won or drawn.
 */
export function isOver(squares) {
  return Boolean(calculateWinner(squares)) || isDraw(squares);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd frontend && npm test`
Expected: PASS, all tests.

- [ ] **Step 5: Rewrite `App.jsx` to use them**

Replace lines 13–21 of `frontend/src/App.jsx` (the `// ponytail:` comment and the four derivations) with calls to the new functions, and update the import. The comment goes away — it described work this task completes.

```jsx
import { useState } from 'react';
import Board from './Board.jsx';
import { calculateWinner, isDraw, isOver, nextPlayer } from './game.js';

const EMPTY_BOARD = Array(9).fill(null);

function App() {
  const [squares, setSquares] = useState(EMPTY_BOARD);
  // Which cell was played last cannot be derived from `squares` — the board
  // records marks, not their order — so unlike the values below it is stored.
  const [lastMove, setLastMove] = useState(null);

  const winner = calculateWinner(squares);
  const drawn = isDraw(squares);
  const over = isOver(squares);
  const player = nextPlayer(squares);

  function handlePlay(index) {
    if (squares[index] || over) {
      return;
    }
    const next = squares.slice();
    next[index] = player;
    setSquares(next);
    setLastMove(index);
  }

  function startNewGame() {
    setSquares(EMPTY_BOARD);
    setLastMove(null);
  }

  let status;
  if (winner) {
    status = `${winner.player} wins!`;
  } else if (drawn) {
    status = 'Draw';
  } else {
    status = `${player} to play`;
  }

  return (
    <main className="container py-5 text-center">
      <h1 className="mb-4">TicTacTooGood</h1>
      <p className="fs-4 mb-4" aria-live="polite">
        {status}
      </p>
      <Board
        squares={squares}
        winningLine={winner?.line}
        lastMove={lastMove}
        isOver={over}
        onPlay={handlePlay}
      />
      <button
        type="button"
        className="btn btn-primary mt-4"
        onClick={startNewGame}
      >
        New Game
      </button>
    </main>
  );
}

export default App;
```

- [ ] **Step 6: Verify the app still behaves**

Run: `cd frontend && npm run lint && npm test`
Expected: lint clean, tests pass.

Then `docker compose up -d`, open `http://localhost:5173`, play a full game to a win and to a draw. Behaviour must be identical to before this task.

- [ ] **Step 7: Stop — do not commit**

Leave the changes unstaged for the user to review and commit.

---

### Task 2: The opponent policy

**Files:**
- Create: `backend/opponent.py`
- Modify: `backend/tests/conftest.py`
- Test: `backend/tests/test_opponent.py`

**Interfaces:**
- Consumes: `game.Board`, `game.legal_moves`, `game.place`, `game.play`, `game.player_to_move`, `game.opponent`, `game.winner`, `rules.name_move`, `solver.analyse_moves` — all already exist.
- Produces:
  - `opponent.Difficulty = Literal["perfect", "fallible"]`
  - `opponent.choose(board: Board, difficulty: Difficulty, rng: random.Random) -> int | None`
  - `conftest.reachable_positions() -> list[Board]`
  - `conftest.immediate_wins(board: Board, mark: str) -> list[int]`

**Note on `game.opponent`:** `game.py` already exports a function called `opponent` (it returns the other mark). The new module is also called `opponent`. Inside `opponent.py`, import it as `from game import opponent as other_mark` to avoid shadowing the module name.

- [ ] **Step 1: Add the test helpers to `conftest.py`**

These are fixtures for the tests, not the deliverable — write them first so the tests can be written against them. Append to `backend/tests/conftest.py`:

```python
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
    return [
        index
        for index in legal_moves(board)
        if winner(place(board, index, mark)) is not None
    ]
```

Update the import at the top of `conftest.py` from `from game import Board` to:

```python
from game import Board, legal_moves, place, play, winner
```

- [ ] **Step 2: Write the failing tests**

Create `backend/tests/test_opponent.py`.

Four of these sweep all 5,478 positions. The whole file runs in under two seconds because `solver.evaluate` is memoised, so the game tree is computed once and reused. Each position is sampled three times, since the policy is random and one draw could miss a bad branch.

```python
import random

from conftest import board, immediate_wins, reachable_positions

from game import Board, legal_moves, play, player_to_move, winner
from game import opponent as other_mark
from opponent import choose
from solver import analyse_moves

SAMPLES = 3


def live_positions() -> list[Board]:
    """Every reachable position where a move can still be made."""
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


def test_fallible_blunders_when_nothing_forces_its_hand() -> None:
    """Without this, an opponent that always played perfectly would pass
    every other test in this file. In quiet positions where a worse move
    exists, fallible must take one."""
    rng = random.Random(0)
    checked = 0
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
            checked += 1
            assert choose(position, "fallible", rng) not in best
    assert checked > 500


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
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd backend && uv run pytest tests/test_opponent.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'opponent'`.

- [ ] **Step 4: Write the implementation**

Create `backend/opponent.py`:

```python
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
    misses a win or a losing block, but it is not looking for forks:

        1. a move named "win"                -> play it
        2. a move named "block"              -> play it
        3. any move that is not optimal      -> play one at random
        4. otherwise                         -> play any legal move at random

    Step 2 can find two blocking moves, which means the opponent has already
    forked; blocking one of them loses anyway, and that is the human error
    being modelled. Step 4 covers the empty board, where every move draws and
    step 3 therefore finds no candidate.

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

    poor = [result.index for result in results if not result.best]
    return rng.choice(poor or list(legal_moves(board)))
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd backend && uv run pytest tests/test_opponent.py -v`
Expected: PASS, 8 tests, under two seconds.

- [ ] **Step 6: Run the whole suite and the linter**

Run: `cd backend && uv run pytest && uv run ruff check . && uv run ruff format --check .`
Expected: all tests pass, no lint findings.

- [ ] **Step 7: Stop — do not commit**

Leave the changes unstaged for the user to review and commit.

---

### Task 3: Expose the opponent through the API

**Files:**
- Modify: `backend/schemas.py`
- Modify: `backend/app.py`
- Test: `backend/tests/test_api.py`

**Interfaces:**
- Consumes: `opponent.choose` from Task 2.
- Produces: `AnalyseRequest.opponent: Literal["perfect", "fallible"] | None`, `AnalyseResponse.suggested: int | None`.

Both fields default to `None`, so every existing request and every existing test keeps working unchanged.

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/test_api.py`. The `client` fixture and the `cells` helper already exist at the top of that file.

```python
def test_no_opponent_means_no_suggestion(client: FlaskClient) -> None:
    response = client.post("/api/analyse", json={"board": cells(".........")})
    assert response.get_json()["suggested"] is None


def test_an_opponent_gets_a_legal_suggestion(client: FlaskClient) -> None:
    response = client.post(
        "/api/analyse",
        json={"board": cells("XX.OO...."), "opponent": "fallible"},
    )
    assert response.status_code == 200
    body = response.get_json()
    assert body["suggested"] in {move["index"] for move in body["moves"]}


def test_a_fallible_opponent_takes_the_win_in_front_of_it(client: FlaskClient) -> None:
    """X to play with 2 completing the top row. Fallible's first rule is to
    win, so this is not left to chance."""
    response = client.post(
        "/api/analyse",
        json={"board": cells("XX.OO...."), "opponent": "fallible"},
    )
    assert response.get_json()["suggested"] == 2


def test_a_finished_game_suggests_nothing(client: FlaskClient) -> None:
    response = client.post(
        "/api/analyse",
        json={"board": cells("XXXOO...."), "opponent": "perfect"},
    )
    body = response.get_json()
    assert body["status"] == "won"
    assert body["moves"] == []
    assert body["suggested"] is None


def test_an_unknown_opponent_is_rejected(client: FlaskClient) -> None:
    response = client.post(
        "/api/analyse",
        json={"board": cells("........."), "opponent": "telepathic"},
    )
    assert response.status_code == 400
    assert "opponent" in response.get_json()["error"]
```

Then **delete** `test_hello_route_still_works` from the same file — the route it covers is removed in Step 4.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && uv run pytest tests/test_api.py -v`
Expected: FAIL — `KeyError: 'suggested'` on the first four, and the unknown-opponent test returning 200 instead of 400.

- [ ] **Step 3: Add the schema fields**

In `backend/schemas.py`, add the field to `AnalyseRequest`, directly under `board`:

```python
    opponent: Literal["perfect", "fallible"] | None = None
```

and to `AnalyseResponse`, as the last field:

```python
    suggested: int | None = None
```

Update the two docstrings to mention them: `AnalyseRequest` becomes "A board submitted for analysis, optionally asking what a given opponent would play." and `AnalyseResponse` becomes "The full analysis of a submitted board, and the computer's move if one was asked for."

- [ ] **Step 4: Wire it into the route, and delete `/api/hello`**

In `backend/app.py`:

Add `import random` as the first import. Add `from opponent import choose` to the local import group **between the `game` imports and `from rules import name_move`** — Ruff's `I` rule sorts that block alphabetically and will flag it anywhere else. Delete the `hello` function entirely along with its route decorator.

Add a module-level generator below `app = Flask(__name__)`:

```python
# One generator for the process, seeded from the OS. The opponent's randomness
# is a gameplay detail, not a security boundary.
_RNG = random.Random()
```

Then, in `analyse`, between the `moves = ...` block and the `response = AnalyseResponse(...)` block:

```python
    suggested = (
        choose(board, payload.opponent, _RNG)
        if payload.opponent is not None and status == "in_progress"
        else None
    )
```

and add `suggested=suggested,` as the last argument to `AnalyseResponse(...)`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd backend && uv run pytest -v`
Expected: PASS, including every pre-existing test.

- [ ] **Step 6: Lint**

Run: `cd backend && uv run ruff check . && uv run ruff format --check .`
Expected: no findings.

- [ ] **Step 7: Verify against the running container**

Run `docker compose up -d --build backend`, then:

```bash
curl -s -X POST http://localhost:5000/api/analyse \
  -H 'Content-Type: application/json' \
  -d '{"board":["X","X",null,"O","O",null,null,null,null],"opponent":"fallible"}' | head -c 400
echo
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:5000/api/hello
```

Expected: the first prints JSON with `"suggested": 2`; the second prints `404`.

- [ ] **Step 8: Stop — do not commit**

Leave the changes unstaged for the user to review and commit.

---

### Task 4: Proxy `/api` through Vite and drop `flask-cors`

The frontend has never called the backend, so there is no existing URL convention. Giving Vite a dev proxy means the frontend calls the relative path `/api/analyse`, which keeps the host out of the source and makes the requests same-origin — at which point `flask-cors` is dead weight.

**Files:**
- Modify: `frontend/vite.config.js`
- Modify: `docker-compose.yml`
- Modify: `backend/app.py`
- Modify: `backend/pyproject.toml` (via `uv remove`)

**Interfaces:**
- Produces: `POST /api/analyse` reachable at `http://localhost:5173/api/analyse`, which is what `useAnalysis` calls in Task 6.

- [ ] **Step 1: Add the proxy**

Replace `frontend/vite.config.js` with:

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The dev server proxies /api to Flask so the frontend can use relative URLs
// and same-origin requests. The target differs between Docker Compose, where
// the backend is a service name, and a bare `npm run dev` on the host.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': process.env.VITE_API_TARGET ?? 'http://localhost:5000',
    },
  },
});
```

`process.env` is correct here rather than `import.meta.env`: this file is evaluated by Node when Vite starts, not shipped to the browser, so the `VITE_` prefix rule does not apply. The name keeps the prefix only for consistency.

- [ ] **Step 2: Point the container at the backend service**

In `docker-compose.yml`, add to the `frontend` service, as a sibling of `depends_on`:

```yaml
    environment:
      - VITE_API_TARGET=http://backend:5000
```

- [ ] **Step 3: Remove the CORS dependency**

In `backend/app.py`, delete the `from flask_cors import CORS` import and the `CORS(app)` line.

Run: `cd backend && uv remove flask-cors`
Expected: `pyproject.toml` and `uv.lock` both updated.

- [ ] **Step 4: Verify the proxy end to end**

Run: `docker compose up -d --build`, wait for both services, then:

```bash
curl -s -X POST http://localhost:5173/api/analyse \
  -H 'Content-Type: application/json' \
  -d '{"board":[null,null,null,null,null,null,null,null,null]}' | head -c 200
```

Expected: the analysis JSON, served through the Vite dev server on port 5173. If it returns the Vite HTML page instead, the proxy is not configured; if it returns a connection error, `VITE_API_TARGET` is not reaching the container.

- [ ] **Step 5: Confirm the backend still passes its own suite**

Run: `cd backend && uv run pytest && uv run ruff check .`
Expected: PASS with no findings. The Flask test client does not go through CORS, so nothing here should have changed.

- [ ] **Step 6: Stop — do not commit**

Leave the changes unstaged for the user to review and commit.

---

### Task 5: The screen shell

`App.jsx` currently *is* the game. It becomes a router between two screens, and the game moves into its own component. Nothing about gameplay changes.

**Files:**
- Modify: `frontend/src/App.jsx` (rewritten)
- Create: `frontend/src/StartScreen.jsx`
- Create: `frontend/src/Game.jsx`

**Interfaces:**
- Consumes: `calculateWinner`, `isDraw`, `isOver`, `nextPlayer` from Task 1; `Board` unchanged.
- Produces:
  - `App` holds `screen: 'start' | 'game'`.
  - `StartScreen({ onStart })`
  - `Game({ onQuit })`

**React note for the implementer.** There is no router and no route table. A screen is just "which component do I render", decided by a piece of state — `screen === 'start' ? <StartScreen/> : <Game/>`. In Flask this was `@app.route`, with the URL as the source of truth and the server deciding what to render. Here the URL never changes and the state is the source of truth. That is a real trade-off, not just a different spelling: the back button and bookmarking do not work, which is fine for a two-screen game and would not be for an app with deep links. Adding `react-router` for two screens would be a dependency earning nothing.

- [ ] **Step 1: Create `StartScreen.jsx`**

```jsx
function StartScreen({ onStart }) {
  return (
    <div className="text-center">
      <h1 className="mb-2">TicTacTooGood</h1>
      <p className="text-body-secondary fs-5 mb-4">
        Learn the patterns that decide the game.
      </p>
      <button type="button" className="btn btn-primary btn-lg" onClick={onStart}>
        Start game
      </button>
    </div>
  );
}

export default StartScreen;
```

- [ ] **Step 2: Create `Game.jsx`**

This is Phase 1's `App` body, with a "Back to menu" button added.

```jsx
import { useState } from 'react';
import Board from './Board.jsx';
import { calculateWinner, isDraw, isOver, nextPlayer } from './game.js';

const EMPTY_BOARD = Array(9).fill(null);

function Game({ onQuit }) {
  const [squares, setSquares] = useState(EMPTY_BOARD);
  // Which cell was played last cannot be derived from `squares` — the board
  // records marks, not their order — so unlike the values below it is stored.
  const [lastMove, setLastMove] = useState(null);

  const winner = calculateWinner(squares);
  const over = isOver(squares);
  const player = nextPlayer(squares);

  function playAt(index) {
    if (squares[index] !== null || over) {
      return;
    }
    const next = squares.slice();
    next[index] = player;
    setSquares(next);
    setLastMove(index);
  }

  function startNewGame() {
    setSquares(EMPTY_BOARD);
    setLastMove(null);
  }

  let status;
  if (winner) {
    status = `${winner.player} wins!`;
  } else if (isDraw(squares)) {
    status = 'Draw';
  } else {
    status = `${player} to play`;
  }

  return (
    <div className="text-center">
      <h1 className="mb-4">TicTacTooGood</h1>
      <p className="fs-4 mb-4" aria-live="polite">
        {status}
      </p>
      <Board
        squares={squares}
        winningLine={winner?.line}
        lastMove={lastMove}
        isOver={over}
        onPlay={playAt}
      />
      <div className="mt-4 d-flex gap-2 justify-content-center">
        <button type="button" className="btn btn-primary" onClick={startNewGame}>
          New Game
        </button>
        <button type="button" className="btn btn-outline-secondary" onClick={onQuit}>
          Back to menu
        </button>
      </div>
    </div>
  );
}

export default Game;
```

- [ ] **Step 3: Rewrite `App.jsx`**

```jsx
import { useState } from 'react';
import Game from './Game.jsx';
import StartScreen from './StartScreen.jsx';

function App() {
  const [screen, setScreen] = useState('start');

  return (
    <main className="container py-5">
      {screen === 'start' ? (
        <StartScreen onStart={() => setScreen('game')} />
      ) : (
        <Game onQuit={() => setScreen('start')} />
      )}
    </main>
  );
}

export default App;
```

- [ ] **Step 4: Lint and test**

Run: `cd frontend && npm run lint && npm test`
Expected: clean, and the `game.js` tests still pass — nothing in this task touches them.

- [ ] **Step 5: Verify in the browser**

`docker compose up -d`, open `http://localhost:5173`.

Check: the start screen appears first; Start game reaches the board; a full game plays to a win with the win line drawn; New Game clears it; Back to menu returns to the start screen; starting again gives a fresh board, not the previous one.

- [ ] **Step 6: Stop — do not commit**

Leave the changes unstaged for the user to review and commit.

---

### Task 6: The analysis hook and the teaching panel

The first frontend/backend round-trip. After this task the player can turn on "Best move" or "Every move" and read the engine's verdict in words. The board itself is not touched — that is Task 7.

**Files:**
- Modify: `frontend/src/game.js`
- Modify: `frontend/src/Board.jsx` (import `CELL_NAMES` instead of defining `CELL_LABELS`)
- Create: `frontend/src/useAnalysis.js`
- Create: `frontend/src/TeachingPanel.jsx`
- Modify: `frontend/src/App.jsx`, `frontend/src/StartScreen.jsx`, `frontend/src/Game.jsx`
- Test: `frontend/src/game.test.js`

**Interfaces:**
- Consumes: `POST /api/analyse` through the proxy from Task 4.
- Produces:
  - `game.js`: `CELL_NAMES: string[]`, `RULE_TEXT: Record<string, string>`, `describeOutcome(outcome, distance) -> string`
  - `useAnalysis(board, opponent, enabled) -> { data, loading, error, retry }`
  - `TeachingPanel({ analysis, loading, teaching })` (default export)
  - `TeachingDial({ value, onChange })` (named export from `TeachingPanel.jsx`)
  - `App` gains `settings = { teaching: 'off' | 'hints' | 'full' }` and passes `settings` + `onChange` to both screens.

- [ ] **Step 1: Write the failing tests for the wording helpers**

The rule and outcome wording is shared by the panel and, in Task 7, by the board's `aria-label`. It lives in `game.js` — the project's pure, non-React module — so both read identical text and the wording is testable without a component framework.

Append to `frontend/src/game.test.js`:

```js
test('describes an outcome in plies, in English', () => {
  assert.equal(describeOutcome('win', 0), 'wins now');
  assert.equal(describeOutcome('win', 3), 'wins in 3');
  assert.equal(describeOutcome('loss', 2), 'loses in 2');
  assert.equal(describeOutcome('draw', 4), 'draws');
});

test('every rule the API can return has wording', () => {
  const fromTheApi = [
    'win',
    'block',
    'fork',
    'block_fork',
    'centre',
    'opposite_corner',
    'empty_corner',
    'empty_side',
  ];
  for (const rule of fromTheApi) {
    assert.equal(typeof RULE_TEXT[rule], 'string');
  }
});

test('there is a name for all nine cells', () => {
  assert.equal(CELL_NAMES.length, 9);
  assert.equal(CELL_NAMES[4], 'centre');
});
```

Add `CELL_NAMES`, `RULE_TEXT` and `describeOutcome` to the existing import from `./game.js` at the top of the file.

- [ ] **Step 2: Run to verify failure**

Run: `cd frontend && npm test`
Expected: FAIL — `describeOutcome is not a function`.

- [ ] **Step 3: Add them to `game.js`**

Append to `frontend/src/game.js`:

```js
/** Human names for the nine cells, in board order. */
export const CELL_NAMES = [
  'top left',
  'top centre',
  'top right',
  'middle left',
  'centre',
  'middle right',
  'bottom left',
  'bottom centre',
  'bottom right',
];

/**
 * Plain-English wording for each rule the API can return. The keys are the
 * `rule` values from `POST /api/analyse`; a missing key means the backend
 * grew a rule the frontend has not been taught.
 */
export const RULE_TEXT = {
  win: 'wins outright',
  block: 'blocks their win',
  fork: 'creates a fork',
  block_fork: 'stops their fork',
  centre: 'takes the centre',
  opposite_corner: 'takes the opposite corner',
  empty_corner: 'takes a corner',
  empty_side: 'takes a side',
};

/**
 * Renders an outcome and distance as English.
 *
 * @param {'win' | 'draw' | 'loss'} outcome - From the mover's perspective.
 * @param {number} distance - Plies remaining after the move is played.
 * @returns {string} Wording such as "wins in 3". Draws carry no number:
 *   how long a drawn game runs is not something a player should optimise.
 */
export function describeOutcome(outcome, distance) {
  if (outcome === 'draw') {
    return 'draws';
  }
  const verb = outcome === 'win' ? 'wins' : 'loses';
  return distance === 0 ? `${verb} now` : `${verb} in ${distance}`;
}
```

- [ ] **Step 4: Run to verify the tests pass**

Run: `cd frontend && npm test`
Expected: PASS.

- [ ] **Step 5: Point `Board.jsx` at `CELL_NAMES`**

In `frontend/src/Board.jsx`, delete the local `CELL_LABELS` array (lines 1–11), add `import { CELL_NAMES } from './game.js';` at the top, and change the one use of `CELL_LABELS[index]` to `CELL_NAMES[index]`. The array contents are identical, so nothing changes on screen.

- [ ] **Step 6: Create `useAnalysis.js`**

```js
import { useCallback, useEffect, useState } from 'react';

/**
 * Fetches the engine's analysis of a board.
 *
 * @param {Array<'X' | 'O' | null>} board - The position to analyse.
 * @param {'perfect' | 'fallible' | null} opponent - Send a value only when it
 *   is the computer's turn; the response's `suggested` is null otherwise.
 * @param {boolean} enabled - When false, no request is made at all.
 * @returns {{ data: object | null, loading: boolean, error: string | null,
 *   retry: () => void }}
 */
export function useAnalysis(board, opponent, enabled) {
  const [state, setState] = useState({
    data: null,
    loading: false,
    error: null,
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setState({ data: null, loading: false, error: null });
      return undefined;
    }

    // Aborting on cleanup is what stops a slow response for an earlier board
    // arriving after a later one and overwriting it.
    const controller = new AbortController();
    setState({ data: null, loading: true, error: null });

    fetch('/api/analyse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(opponent ? { board, opponent } : { board }),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error ?? `The server returned ${response.status}.`);
        }
        return response.json();
      })
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((error) => {
        if (error.name === 'AbortError') {
          return;
        }
        setState({ data: null, loading: false, error: error.message });
      });

    return () => controller.abort();
  }, [board, opponent, enabled, attempt]);

  const retry = useCallback(() => setAttempt((count) => count + 1), []);

  return { ...state, retry };
}
```

**Why `attempt` exists:** an effect re-runs when its dependencies change, and "the user pressed Retry" is not a change to the board. Bumping a counter that the effect depends on is the standard way to say "run that again" without duplicating the fetch logic outside the effect.

**Why this is an effect at all**, when Task 8's who-goes-first toggle deliberately is not: an effect is for synchronising with something *outside* React — here, the network. Reacting to your own state changes is not.

- [ ] **Step 7: Create `TeachingPanel.jsx`**

```jsx
import { CELL_NAMES, RULE_TEXT, describeOutcome } from './game.js';

const DIAL_OPTIONS = [
  { value: 'off', label: 'Nothing' },
  { value: 'hints', label: 'Best move' },
  { value: 'full', label: 'Every move' },
];

/**
 * The three-position teaching control. Three positions rather than two
 * checkboxes because "every move" strictly contains "best move" — two
 * checkboxes would imply four states where there are three.
 */
export function TeachingDial({ value, onChange }) {
  return (
    <fieldset className="mb-3">
      <legend className="fs-6 text-body-secondary">Show me</legend>
      <div className="btn-group" role="group">
        {DIAL_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={
              option.value === value
                ? 'btn btn-primary'
                : 'btn btn-outline-primary'
            }
            aria-pressed={option.value === value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function MoveRow({ move }) {
  return (
    <li className="list-group-item d-flex justify-content-between align-items-baseline">
      <span>
        {move.best ? '★ ' : ''}
        {CELL_NAMES[move.index]}
      </span>
      <span className="text-body-secondary small text-end">
        {RULE_TEXT[move.rule]}
        <br />
        {describeOutcome(move.outcome, move.distance)}
      </span>
    </li>
  );
}

function TeachingPanel({ analysis, loading, teaching }) {
  if (loading || !analysis) {
    return (
      <p className="text-body-secondary" aria-live="polite">
        <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />
        Analysing…
      </p>
    );
  }

  if (analysis.status !== 'in_progress') {
    return <p className="text-body-secondary">The game is over.</p>;
  }

  const best = analysis.moves.filter((move) => move.best);
  const rest = analysis.moves.filter((move) => !move.best);

  return (
    <div className="text-start">
      <h2 className="fs-5">Best moves</h2>
      <ul className="list-group mb-3">
        {best.map((move) => (
          <MoveRow key={move.index} move={move} />
        ))}
      </ul>
      {teaching === 'full' && rest.length > 0 && (
        <>
          <h2 className="fs-5">Also legal</h2>
          <ul className="list-group">
            {rest.map((move) => (
              <MoveRow key={move.index} move={move} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export default TeachingPanel;
```

**Rows are grouped by the `best` boolean and keep index order inside each group.** Do not sort them by quality. Sorting would mean re-deriving the win-sooner/lose-later ordering in JavaScript, which the Phase 2a spec identifies as the third encoding of that total order and the one most likely to get the loss inversion backwards. If a ranked list is ever needed, the server grows a `rank` field.

- [ ] **Step 8: Lift `settings` into `App.jsx`**

```jsx
import { useState } from 'react';
import Game from './Game.jsx';
import StartScreen from './StartScreen.jsx';

const DEFAULT_SETTINGS = { teaching: 'hints' };

function App() {
  const [screen, setScreen] = useState('start');
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  return (
    <main className="container py-5">
      {screen === 'start' ? (
        <StartScreen
          settings={settings}
          onChange={setSettings}
          onStart={() => setScreen('game')}
        />
      ) : (
        <Game
          settings={settings}
          onChange={setSettings}
          onQuit={() => setScreen('start')}
        />
      )}
    </main>
  );
}

export default App;
```

`settings` lives in `App` rather than in `Game` because both screens set it — this is "lifting state up": the nearest common ancestor owns the value and passes it down with a setter. The Flask instinct would be a session or a global; here it is one `useState` in the component that contains both readers.

- [ ] **Step 9: Add the dial to `StartScreen.jsx`**

```jsx
import { TeachingDial } from './TeachingPanel.jsx';

function StartScreen({ settings, onChange, onStart }) {
  return (
    <div className="text-center">
      <h1 className="mb-2">TicTacTooGood</h1>
      <p className="text-body-secondary fs-5 mb-4">
        Learn the patterns that decide the game.
      </p>
      <div className="d-inline-block text-start">
        <TeachingDial
          value={settings.teaching}
          onChange={(teaching) => onChange({ ...settings, teaching })}
        />
      </div>
      <div>
        <button type="button" className="btn btn-primary btn-lg mt-3" onClick={onStart}>
          Start game
        </button>
      </div>
    </div>
  );
}

export default StartScreen;
```

- [ ] **Step 10: Wire the panel into `Game.jsx`**

Change the signature to `function Game({ settings, onChange, onQuit })`, add the imports, call the hook, and put the board and panel in a two-column row. The board keeps its existing props for now.

```jsx
import { useState } from 'react';
import Board from './Board.jsx';
import TeachingPanel, { TeachingDial } from './TeachingPanel.jsx';
import { useAnalysis } from './useAnalysis.js';
import { calculateWinner, isDraw, isOver, nextPlayer } from './game.js';
```

Inside the component, after the derived values:

```jsx
  const teachingOn = settings.teaching !== 'off';
  const { data, loading, error, retry } = useAnalysis(squares, null, teachingOn);
```

The failure alert lives in `Game`, not in `TeachingPanel`. From Task 8 a request
happens even when teaching is off (the computer needs its move), and the panel is
not on screen then — so the one place guaranteed to be rendered has to own it.
Add this immediately above the row:

```jsx
      {error && (
        <div className="alert alert-warning" role="alert">
          <p className="mb-2">Analysis unavailable: {error}</p>
          <button type="button" className="btn btn-sm btn-warning" onClick={retry}>
            Retry
          </button>
        </div>
      )}
```

Then replace the returned markup's board block with:

```jsx
      <div className="row justify-content-center g-4">
        <div className={teachingOn ? 'col-lg-7' : 'col-12'}>
          <Board
            squares={squares}
            winningLine={winner?.line}
            lastMove={lastMove}
            isOver={over}
            onPlay={playAt}
          />
        </div>
        {teachingOn && (
          <div className="col-lg-5">
            <TeachingDial
              value={settings.teaching}
              onChange={(teaching) => onChange({ ...settings, teaching })}
            />
            <TeachingPanel
              analysis={data}
              loading={loading}
              teaching={settings.teaching}
            />
          </div>
        )}
      </div>
```

When teaching is off the dial disappears with the panel, so add a second `TeachingDial` above the row, rendered only when `!teachingOn`, so the player can switch it back on:

```jsx
      {!teachingOn && (
        <div className="d-flex justify-content-center">
          <TeachingDial
            value={settings.teaching}
            onChange={(teaching) => onChange({ ...settings, teaching })}
          />
        </div>
      )}
```

- [ ] **Step 11: Lint and test**

Run: `cd frontend && npm run lint && npm test`
Expected: clean and passing.

- [ ] **Step 12: Verify in the browser**

`docker compose up -d --build`, open `http://localhost:5173`.

Check each of these:
- Teaching set to Nothing: the board is full width, no panel, and the Network tab shows **no** request to `/api/analyse`.
- Best move: the panel lists only starred rows and updates after every move.
- Every move: an "Also legal" group appears with the remaining cells.
- On an empty board every row reads "draws" and all nine are starred — correct, not a bug.
- Stop the backend (`docker compose stop backend`), play a move: the panel shows "Analysis unavailable" with a Retry, and **the board still works**. Restart the backend and press Retry; the panel recovers.
- The console is free of errors and of React key warnings.

- [ ] **Step 13: Stop — do not commit**

Leave the changes unstaged for the user to review and commit.

---

### Task 7: Annotate the board

The panel already says everything in words. This task puts it on the squares: an outcome tint on every empty cell in "Every move", a star on the optimal cells in both modes, and a two-way highlight linking a panel row to its square.

**Files:**
- Modify: `frontend/src/Board.jsx`
- Modify: `frontend/src/TeachingPanel.jsx`
- Modify: `frontend/src/Game.jsx`
- Modify: `frontend/src/index.css`

**Interfaces:**
- Consumes: `data.moves` from `useAnalysis` (Task 6); `CELL_NAMES`, `RULE_TEXT`, `describeOutcome` from `game.js`.
- Produces:
  - `Board` gains `moves`, `teaching`, `hoveredIndex`, `onHover`.
  - `TeachingPanel` gains `hoveredIndex`, `onHover`.
  - `Game` owns `hoveredIndex`.

- [ ] **Step 1: Replace `Board.jsx`**

```jsx
import { CELL_NAMES, RULE_TEXT, describeOutcome } from './game.js';

/** Maps a cell index to the centre of that cell in the SVG's 3x3 coordinate space. */
const cellCentre = (index) => ({
  x: (index % 3) + 0.5,
  y: Math.floor(index / 3) + 0.5,
});

/** How far past each end cell's centre the win line reaches, in cell widths. */
const OVERSHOOT = 0.25;

/**
 * Endpoints of the line across a winning triple. Each end runs a quarter of a
 * cell past the outer centres, so the line covers 75% of its end cells instead
 * of stopping dead in the middle of a glyph.
 */
const lineEnds = (line) => {
  const from = cellCentre(line[0]);
  const to = cellCentre(line[2]);
  const dx = Math.sign(to.x - from.x) * OVERSHOOT;
  const dy = Math.sign(to.y - from.y) * OVERSHOOT;
  return { x1: from.x - dx, y1: from.y - dy, x2: to.x + dx, y2: to.y + dy };
};

function Board({
  squares,
  winningLine,
  lastMove,
  isOver,
  onPlay,
  moves = null,
  teaching = 'off',
  hoveredIndex = null,
  onHover = () => {},
}) {
  const ends = winningLine && lineEnds(winningLine);

  // In "Best move" only the optimal cells are annotated, so the rest of the
  // position stays unspoiled — including in the aria-labels.
  const shown = (moves ?? []).filter(
    (move) => teaching === 'full' || move.best,
  );
  const analysis = new Map(shown.map((move) => [move.index, move]));

  function cellClass(index) {
    const move = analysis.get(index);
    const classes = ['board-cell'];
    if (index === lastMove) {
      classes.push('board-cell-last');
    }
    if (move && teaching === 'full') {
      classes.push(`board-cell-${move.outcome}`);
    }
    if (move?.best) {
      classes.push('board-cell-best');
    }
    if (index === hoveredIndex) {
      classes.push('board-cell-linked');
    }
    return classes.join(' ');
  }

  function cellLabel(index, square) {
    const parts = [CELL_NAMES[index], square ?? 'empty'];
    if (index === lastMove) {
      parts.push('last move');
    }
    const move = analysis.get(index);
    if (move) {
      // The verdict goes in the label because the tint alone must not be the
      // only way to learn it (WCAG 1.4.1).
      parts.push(describeOutcome(move.outcome, move.distance));
      parts.push(RULE_TEXT[move.rule]);
    }
    return parts.join(', ');
  }

  return (
    <div className="board mx-auto">
      {squares.map((square, index) => (
        <button
          key={index}
          type="button"
          className={cellClass(index)}
          onClick={() => onPlay(index)}
          onMouseEnter={() => onHover(index)}
          onMouseLeave={() => onHover(null)}
          onFocus={() => onHover(index)}
          onBlur={() => onHover(null)}
          aria-disabled={Boolean(square) || isOver}
          aria-label={cellLabel(index, square)}
        >
          {square ??
            (analysis.get(index)?.best ? (
              <span className="board-star" aria-hidden="true">
                ★
              </span>
            ) : null)}
        </button>
      ))}
      {winningLine && (
        <svg className="win-line" viewBox="0 0 3 3" aria-hidden="true">
          <line x1={ends.x1} y1={ends.y1} x2={ends.x2} y2={ends.y2} />
        </svg>
      )}
    </div>
  );
}

export default Board;
```

Note the defaults on the new props. `Board` is still usable without any of them, which keeps the "teaching off" path unchanged.

- [ ] **Step 2: Add the styles**

Append to `frontend/src/index.css`:

```css
/* Annotation tints. Bootstrap's subtle pairs are theme-aware, like the
   last-move yellow above. Empty cells only, so these never fight it. */
.board-cell.board-cell-win {
  background: var(--bs-success-bg-subtle);
  border-color: var(--bs-success-border-subtle);
}

.board-cell.board-cell-draw {
  background: var(--bs-secondary-bg-subtle);
  border-color: var(--bs-secondary-border-subtle);
}

.board-cell.board-cell-loss {
  background: var(--bs-danger-bg-subtle);
  border-color: var(--bs-danger-border-subtle);
}

/* Links a panel row to its square, in both directions. */
.board-cell.board-cell-linked {
  outline: 3px solid var(--bs-primary);
  outline-offset: -3px;
}

.board-star {
  font-size: 0.4em;
  opacity: 0.65;
}
```

- [ ] **Step 3: Make the panel rows highlight their cell**

In `frontend/src/TeachingPanel.jsx`, replace `MoveRow` and thread the two new props through `TeachingPanel`:

```jsx
function MoveRow({ move, hovered, onHover }) {
  return (
    <li
      className={
        hovered
          ? 'list-group-item list-group-item-primary d-flex justify-content-between align-items-baseline'
          : 'list-group-item d-flex justify-content-between align-items-baseline'
      }
      onMouseEnter={() => onHover(move.index)}
      onMouseLeave={() => onHover(null)}
    >
      <span>
        {move.best ? '★ ' : ''}
        {CELL_NAMES[move.index]}
      </span>
      <span className="text-body-secondary small text-end">
        {RULE_TEXT[move.rule]}
        <br />
        {describeOutcome(move.outcome, move.distance)}
      </span>
    </li>
  );
}
```

`TeachingPanel` becomes
`function TeachingPanel({ analysis, loading, error, teaching, hoveredIndex, onHover })`,
and both `<MoveRow>` call sites become:

```jsx
          <MoveRow
            key={move.index}
            move={move}
            hovered={move.index === hoveredIndex}
            onHover={onHover}
          />
```

**Keep the `error` prop and its early `return null`.** Task 6's fix round added
them: `Game` owns the error alert, so the panel must render nothing rather than
show a spinner that never resolves beside it. Do not drop either while editing
this file.

**Rows stay plain `<li>` elements, not buttons.** Making them focusable would mean giving them a click action we have not designed. The keyboard path already exists in the direction that matters: cells *are* buttons, so tabbing to a square highlights its row and reads the full verdict from `aria-label`. No information is available by hover alone.

- [ ] **Step 4: Own `hoveredIndex` in `Game.jsx`**

Add the state next to the others:

```jsx
  const [hoveredIndex, setHoveredIndex] = useState(null);
```

Pass the new props to both children:

```jsx
          <Board
            squares={squares}
            winningLine={winner?.line}
            lastMove={lastMove}
            isOver={over}
            onPlay={playAt}
            moves={data?.moves}
            teaching={settings.teaching}
            hoveredIndex={hoveredIndex}
            onHover={setHoveredIndex}
          />
```

```jsx
            <TeachingPanel
              analysis={data}
              loading={loading}
              error={error}
              teaching={settings.teaching}
              hoveredIndex={hoveredIndex}
              onHover={setHoveredIndex}
            />
```

One piece of state in the common parent, read by both children, written by both — the same lifting-state-up pattern as `settings`, one level down.

- [ ] **Step 5: Lint and test**

Run: `cd frontend && npm run lint && npm test`
Expected: clean and passing.

- [ ] **Step 6: Verify in the browser**

- "Every move": every empty cell is tinted; the tints change as the position changes; a filled cell is never tinted.
- "Best move": stars appear, but no tints and no verdicts on the other cells — inspect a non-best cell's `aria-label` and confirm it says only its name and "empty".
- Hovering a panel row outlines its square; hovering a square highlights its row.
- Tab through the squares: focus outlines the cell, highlights the row, and a screen reader (or the accessibility inspector) reads the verdict and rule.
- The last-move yellow still shows on the cell just played.
- Set the browser to dark mode and confirm all three tints are still legible.

- [ ] **Step 7: Stop — do not commit**

Leave the changes unstaged for the user to review and commit.

---

### Task 8: The computer opponent

The last task. The start screen gains the opponent choice, `Game` gains the mark assignment and the who-goes-first toggle, and an effect plays `suggested` when it is the computer's turn.

**Files:**
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/StartScreen.jsx`
- Modify: `frontend/src/Game.jsx`

**Interfaces:**
- Consumes: `suggested` from the API (Task 3); `useAnalysis`'s `opponent` argument (Task 6); `playedCount` (Task 1).
- Produces: `settings = { opponent, teaching, computerFirst }`; `Game` owns `humanMark`.

- [ ] **Step 1: Extend the default settings in `App.jsx`**

```jsx
const DEFAULT_SETTINGS = {
  opponent: 'hotseat',
  teaching: 'hints',
  computerFirst: false,
};
```

Nothing else in `App.jsx` changes — it already passes the whole `settings` object and its setter to both screens.

- [ ] **Step 2: Add the opponent choice to `StartScreen.jsx`**

```jsx
import { TeachingDial } from './TeachingPanel.jsx';

const OPPONENTS = [
  { value: 'hotseat', label: 'Hotseat', hint: 'Two players, one screen.' },
  {
    value: 'fallible',
    label: 'Computer — fallible',
    hint: 'Knows not to hand you the game, but misses forks.',
  },
  {
    value: 'perfect',
    label: 'Computer — perfect',
    hint: 'Cannot be beaten. A draw is the win.',
  },
];

function StartScreen({ settings, onChange, onStart }) {
  return (
    <div className="text-center">
      <h1 className="mb-2">TicTacTooGood</h1>
      <p className="text-body-secondary fs-5 mb-4">
        Learn the patterns that decide the game.
      </p>
      <div className="d-inline-block text-start">
        <fieldset className="mb-4">
          <legend className="fs-6 text-body-secondary">Who are you playing?</legend>
          <div className="d-grid gap-2">
            {OPPONENTS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={
                  option.value === settings.opponent
                    ? 'btn btn-primary text-start'
                    : 'btn btn-outline-primary text-start'
                }
                aria-pressed={option.value === settings.opponent}
                onClick={() => onChange({ ...settings, opponent: option.value })}
              >
                <strong>{option.label}</strong>
                <br />
                <small>{option.hint}</small>
              </button>
            ))}
          </div>
        </fieldset>
        <TeachingDial
          value={settings.teaching}
          onChange={(teaching) => onChange({ ...settings, teaching })}
        />
      </div>
      <div>
        <button type="button" className="btn btn-primary btn-lg mt-3" onClick={onStart}>
          Start game
        </button>
      </div>
    </div>
  );
}

export default StartScreen;
```

- [ ] **Step 3: Rewrite `Game.jsx`**

```jsx
import { useEffect, useState } from 'react';
import Board from './Board.jsx';
import TeachingPanel, { TeachingDial } from './TeachingPanel.jsx';
import { useAnalysis } from './useAnalysis.js';
import {
  calculateWinner,
  isDraw,
  isOver,
  nextPlayer,
  playedCount,
} from './game.js';

const EMPTY_BOARD = Array(9).fill(null);

/** How long the computer appears to think, so its move reads as a move. */
const THINKING_MS = 400;

function Game({ settings, onChange, onQuit }) {
  const [squares, setSquares] = useState(EMPTY_BOARD);
  // Which cell was played last cannot be derived from `squares` — the board
  // records marks, not their order — so unlike the values below it is stored.
  const [lastMove, setLastMove] = useState(null);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  // Locked when the game starts. See `toggleWhoStarts` for why this is state
  // rather than a value derived from settings.computerFirst.
  const [humanMark, setHumanMark] = useState(
    settings.computerFirst ? 'O' : 'X',
  );

  const winner = calculateWinner(squares);
  const over = isOver(squares);
  const player = nextPlayer(squares);
  const played = playedCount(squares);

  const vsComputer = settings.opponent !== 'hotseat';
  const isComputerTurn = vsComputer && !over && player !== humanMark;
  const teachingOn = settings.teaching !== 'off';

  const { data, loading, error, retry } = useAnalysis(
    squares,
    isComputerTurn ? settings.opponent : null,
    teachingOn || isComputerTurn,
  );

  function playAt(index) {
    if (squares[index] !== null || over) {
      return;
    }
    const next = squares.slice();
    next[index] = player;
    setSquares(next);
    setLastMove(index);
  }

  // The board's click handler, as opposed to `playAt`, which the computer's
  // effect also calls. Cells are aria-disabled during the computer's turn, but
  // aria-disabled does not block a click, so the turn is enforced here.
  function handleCellClick(index) {
    if (isComputerTurn) {
      return;
    }
    playAt(index);
  }

  useEffect(() => {
    if (!isComputerTurn || data?.suggested == null) {
      return undefined;
    }
    const timer = setTimeout(() => playAt(data.suggested), THINKING_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComputerTurn, data]);

  function startNewGame() {
    setSquares(EMPTY_BOARD);
    setLastMove(null);
    setHoveredIndex(null);
    setHumanMark(settings.computerFirst ? 'O' : 'X');
  }

  function toggleWhoStarts() {
    const computerFirst = !settings.computerFirst;
    onChange({ ...settings, computerFirst });
    // Only while the board is empty. Flipping this mid-game would otherwise
    // make it the computer's turn immediately and let it steal a move.
    if (played === 0) {
      setHumanMark(computerFirst ? 'O' : 'X');
    }
  }

  let status;
  if (winner) {
    status = vsComputer
      ? winner.player === humanMark
        ? 'You win!'
        : 'The computer wins.'
      : `${winner.player} wins!`;
  } else if (isDraw(squares)) {
    status = vsComputer ? 'Draw — the best there is.' : 'Draw';
  } else if (vsComputer) {
    status = isComputerTurn ? 'Computer thinking…' : `Your turn — you are ${humanMark}`;
  } else {
    status = `${player} to play`;
  }

  return (
    <div className="text-center">
      <h1 className="mb-4">TicTacTooGood</h1>
      <p className="fs-4 mb-4" aria-live="polite">
        {status}
      </p>

      {error && (
        <div className="alert alert-warning" role="alert">
          <p className="mb-2">Analysis unavailable: {error}</p>
          <button type="button" className="btn btn-sm btn-warning" onClick={retry}>
            Retry
          </button>
        </div>
      )}

      {!teachingOn && (
        <div className="d-flex justify-content-center">
          <TeachingDial
            value={settings.teaching}
            onChange={(teaching) => onChange({ ...settings, teaching })}
          />
        </div>
      )}

      <div className="row justify-content-center g-4">
        <div className={teachingOn ? 'col-lg-7' : 'col-12'}>
          <Board
            squares={squares}
            winningLine={winner?.line}
            lastMove={lastMove}
            isOver={over || isComputerTurn}
            onPlay={handleCellClick}
            moves={isComputerTurn ? null : data?.moves}
            teaching={settings.teaching}
            hoveredIndex={hoveredIndex}
            onHover={setHoveredIndex}
          />
        </div>
        {teachingOn && (
          <div className="col-lg-5">
            <TeachingDial
              value={settings.teaching}
              onChange={(teaching) => onChange({ ...settings, teaching })}
            />
            {isComputerTurn ? (
              <p className="text-body-secondary text-start" aria-live="polite">
                Thinking…
              </p>
            ) : (
              <TeachingPanel
                analysis={data}
                loading={loading}
                error={error}
                teaching={settings.teaching}
                hoveredIndex={hoveredIndex}
                onHover={setHoveredIndex}
              />
            )}
          </div>
        )}
      </div>

      {vsComputer && (
        <div className="mt-4">
          <div className="form-check form-switch d-inline-flex align-items-center gap-2">
            <input
              className="form-check-input"
              type="checkbox"
              role="switch"
              id="computer-first"
              checked={settings.computerFirst}
              onChange={toggleWhoStarts}
            />
            <label className="form-check-label" htmlFor="computer-first">
              Computer goes first
            </label>
          </div>
          {played > 0 && (
            <p className="text-body-secondary small mb-0">
              Changes apply to the next game.
            </p>
          )}
        </div>
      )}

      <div className="mt-4 d-flex gap-2 justify-content-center">
        <button type="button" className="btn btn-primary" onClick={startNewGame}>
          New Game
        </button>
        <button type="button" className="btn btn-outline-secondary" onClick={onQuit}>
          Back to menu
        </button>
      </div>
    </div>
  );
}

export default Game;
```

**Two things in there are deliberate and should survive review.**

*`toggleWhoStarts` is an event handler, not an effect.* The instinct is a `useEffect` watching `settings.computerFirst` that syncs `humanMark`. React's own guidance is that effects synchronise with things outside React — the network, timers, the DOM — not with your own state changes. Something that happens *because the user clicked* belongs in the click handler. The effect version also cannot tell a click from a re-render, so "only while the board is empty" becomes fiddly there and is one `if` here.

*The human cannot move during the computer's turn.* `Board`'s cells use
`aria-disabled` rather than the `disabled` attribute — a Phase 1 decision that keeps
the just-played cell focusable — but `aria-disabled` does not stop a click. Without
`handleCellClick`, clicking during the ~400ms think delay places the *computer's*
mark wherever you click, and the computer's own move is then dropped. This
reproduced on 3 of 3 attempts before the guard existed. `isOver={over ||
isComputerTurn}` makes the cells announce themselves unavailable while it thinks, so
the ARIA state matches what the handler enforces.

*The computer's opening move needs no special case.* Flipping the switch on an empty board makes `isComputerTurn` true, which makes the hook fetch with `opponent` set, which fills `data.suggested`, which fires the existing effect. New Game does the same. There is no "if the computer starts, play an opening move" branch anywhere, and there should not be one.

- [ ] **Step 4: Lint and test**

Run: `cd frontend && npm run lint && npm test`
Expected: clean and passing. If oxlint objects to the `eslint-disable-next-line` comment (it is not an oxlint directive), delete that line — `react-hooks/exhaustive-deps` is not among the enabled rules, so the comment is only a note to a human reader. Replace it with a plain comment if you prefer:
`// playAt is intentionally not a dependency: it is redefined every render.`

- [ ] **Step 5: Verify the opponent in the browser**

`docker compose up -d --build`, open `http://localhost:5173`.

- Choose **Computer — fallible**, Start. You are X and move first. The computer replies after a visible pause.
- Deliberately set up two in a row. The computer must block it. Repeat several times; it must never once fail to block.
- Play on and try to build a fork. It should be possible to beat the fallible opponent.
- Start a new game as **Computer — perfect** and try to win. You must not be able to. Reaching a draw shows "Draw — the best there is."
- On an empty board, flip **Computer goes first**: the computer plays immediately and the status reads "Your turn — you are O".
- Flip it again mid-game: nothing moves, and "Changes apply to the next game" appears. Press New Game and confirm the change takes effect.
- Start several games against perfect with the computer first; the opening cell should vary between games.
- Set teaching to Nothing in computer mode: the panel disappears but the computer still plays, and the Network tab still shows one request per computer turn and none on your own turn.
- Stop the backend mid-game in computer mode: the error alert with Retry appears, the board is left untouched, and no move is invented. Restart the backend, press Retry, and the computer moves.

- [ ] **Step 6: Run everything one last time**

```bash
cd backend && uv run pytest && uv run ruff check . && uv run ruff format --check .
cd ../frontend && npm run lint && npm test
```

Expected: all green.

- [ ] **Step 7: Accessibility pass**

With the app open, run a Lighthouse audit. Phase 1 scored 100 on both accessibility and best practices; this phase must not regress either. Check specifically that the annotated cells' labels read sensibly and that the switch is reachable and announced.

- [ ] **Step 8: Stop — do not commit**

Leave the changes unstaged for the user to review and commit. This completes Phase 2b.
