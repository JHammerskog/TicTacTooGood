# Phase 1: Playable Tic-Tac-Toe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A properly styled, responsive, hotseat-playable game of tic-tac-toe with a turn indicator, draw detection, a New Game button, and a line drawn across the winning row.

**Architecture:** All game state and rules live in React; the backend is untouched. `App` holds one piece of state (a 9-element `squares` array) and derives everything else — whose turn it is, the winner, and whether the board is drawn — during render. `Board` is a presentational child that renders the grid and reports clicks upward. Win detection is a pure function in its own module, unit-tested without rendering anything.

**Tech Stack:** React 19 (Vite, JavaScript), Bootstrap 5 for styling, custom CSS only for the grid and win line, Node's built-in test runner (`node --test`) for the pure logic.

**Spec:** `docs/superpowers/specs/2026-08-24-phase1-playable-game-design.md`

## Global Constraints

- **Never run git commands that write state** (`add`, `commit`, `branch`, `push`). Every task ends with changes left unstaged for the user to review and commit themselves — do not run `git add`/`git commit` even though the task template would normally end that way.
- All work is inside `frontend/`. The backend is not modified in this phase; `backend/app.py` and its `/api/hello` route stay exactly as they are.
- JavaScript style: ES6+, semicolons required, Prettier defaults (2-space indent). Run `npx prettier --write` on every file you create or change.
- `npm run lint` (oxlint) must exit 0 with no findings before a task is considered done.
- Bootstrap 5 utilities first. Write custom CSS only for what Bootstrap has no utility for, and put it in the existing `frontend/src/index.css`.
- No new npm dependencies in this phase. The test runner is built into Node — nothing to install.
- Node commands (`npm run lint`, `npm test`, `npx prettier`) run on the **host** from the `frontend/` directory. Node v22.22.1 is installed system-wide. The browser check runs against the containers via `docker compose up`.

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `frontend/src/game.js` | Create (Task 1) | `calculateWinner(squares)` — the only game rule, kept pure and component-free |
| `frontend/src/game.test.js` | Create (Task 1) | Unit tests for `calculateWinner` |
| `frontend/package.json` | Modify (Task 1) | Add a `test` script |
| `frontend/src/Board.jsx` | Create (Task 2), Modify (Task 3) | The 3x3 grid of buttons; Task 3 adds the win-line SVG |
| `frontend/src/App.jsx` | Replace (Task 2), Modify (Task 3) | Game state, status text, New Game button |
| `frontend/src/index.css` | Modify (Task 2, Task 3) | Grid layout and cell styling; Task 3 adds the win line |

---

## Task 1: Win detection

The one piece of real logic in this phase. It is pure — board in, result out, no React — which is what makes it testable without rendering, and it is what Phase 2's solver will build on.

**Files:**
- Create: `frontend/src/game.js`
- Test: `frontend/src/game.test.js`
- Modify: `frontend/package.json` (add `test` script)

**Interfaces:**
- Consumes: nothing.
- Produces: `calculateWinner(squares)` — takes a 9-element array whose entries are `'X'`, `'O'`, or `null`, indexed left-to-right then top-to-bottom (index 0 is top-left, index 8 is bottom-right). Returns `{ player: 'X' | 'O', line: [number, number, number] }` when someone has won, or `null` when nobody has. Tasks 2 and 3 both depend on this exact shape: Task 2 reads `.player`, Task 3 reads `.line`.

- [ ] **Step 1: Add the test script to `frontend/package.json`**

In the `"scripts"` block, add a `test` entry alongside the existing ones:

```json
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "oxlint",
    "test": "node --test",
    "preview": "vite preview"
  },
```

Node's built-in runner discovers `*.test.js` files under the current directory and skips `node_modules` automatically. `frontend/package.json` already sets `"type": "module"`, so the ESM `import` statements in the test file work with no configuration and no dependency.

- [ ] **Step 2: Write the failing test**

Create `frontend/src/game.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateWinner } from './game.js';

/**
 * Builds a board from a 9-character string, reading left-to-right then
 * top-to-bottom. '.' means an empty square.
 */
const board = (cells) => [...cells].map((cell) => (cell === '.' ? null : cell));

test('detects each of the three winning rows', () => {
  assert.deepEqual(calculateWinner(board('XXX.O.O..')), {
    player: 'X',
    line: [0, 1, 2],
  });
  assert.deepEqual(calculateWinner(board('O..XXXO..')), {
    player: 'X',
    line: [3, 4, 5],
  });
  assert.deepEqual(calculateWinner(board('.O..O.XXX')), {
    player: 'X',
    line: [6, 7, 8],
  });
});

test('detects each of the three winning columns', () => {
  assert.deepEqual(calculateWinner(board('X.OX.OX..')), {
    player: 'X',
    line: [0, 3, 6],
  });
  assert.deepEqual(calculateWinner(board('OXOOX..X.')), {
    player: 'X',
    line: [1, 4, 7],
  });
  assert.deepEqual(calculateWinner(board('O.XO.X..X')), {
    player: 'X',
    line: [2, 5, 8],
  });
});

test('detects both diagonals', () => {
  assert.deepEqual(calculateWinner(board('X..OXO..X')), {
    player: 'X',
    line: [0, 4, 8],
  });
  assert.deepEqual(calculateWinner(board('O.XOX.X..')), {
    player: 'X',
    line: [2, 4, 6],
  });
});

test('reports the winning player, not just X', () => {
  assert.deepEqual(calculateWinner(board('OOOXX.X..')), {
    player: 'O',
    line: [0, 1, 2],
  });
});

test('returns null for an empty board', () => {
  assert.equal(calculateWinner(board('.........')), null);
});

test('returns null for a game still in progress', () => {
  assert.equal(calculateWinner(board('XX.OO....')), null);
});

test('returns null for a full board with no winner', () => {
  assert.equal(calculateWinner(board('XXOOOXXOX')), null);
});
```

The empty-board test is not filler: it is the one that catches the classic
bug where three `null` squares compare equal to each other and report a
phantom winner.

- [ ] **Step 3: Run the test to verify it fails**

Run from `frontend/`:

```bash
npm test
```

Expected: FAIL — the runner cannot resolve `./game.js`, which does not exist yet.

- [ ] **Step 4: Write the implementation**

Create `frontend/src/game.js`:

```js
const WINNING_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

/**
 * Finds the winner of a tic-tac-toe board, if there is one.
 *
 * @param {Array<'X' | 'O' | null>} squares - 9 cells, left-to-right then
 *   top-to-bottom.
 * @returns {{ player: 'X' | 'O', line: number[] } | null} The winner and the
 *   three indices that won, or null if nobody has won. The line is returned
 *   because the UI draws across it.
 */
export function calculateWinner(squares) {
  for (const line of WINNING_LINES) {
    const [a, b, c] = line;
    if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
      return { player: squares[a], line };
    }
  }
  return null;
}
```

The leading `squares[a] &&` is what makes the empty-board case return `null`
rather than reporting `null` as the winner.

- [ ] **Step 5: Run the tests to verify they pass**

Run from `frontend/`:

```bash
npm test
```

Expected: PASS — 7 tests, 0 failures.

- [ ] **Step 6: Format and lint**

Run from `frontend/`:

```bash
npx prettier --write src/game.js src/game.test.js package.json
npm run lint
```

Expected: Prettier rewrites or leaves the files unchanged; oxlint exits 0 with no findings.

- [ ] **Step 7: Stop — do not commit**

Leave the changes unstaged. The user reviews and commits them.

---

## Task 2: Playable board

A complete, styled, playable game — everything except the win line, which Task 3 draws.

**Files:**
- Create: `frontend/src/Board.jsx`
- Replace: `frontend/src/App.jsx` (the whole file; the current hello-world contents go away)
- Modify: `frontend/src/index.css` (append)

**Interfaces:**
- Consumes: `calculateWinner(squares)` from Task 1, returning `{ player, line } | null`.
- Produces: `Board` as the default export of `Board.jsx`, taking props `{ squares, isOver, onPlay }` — `squares` is the 9-element board array, `isOver` is a boolean disabling every cell, and `onPlay` is a callback taking a cell index. Task 3 adds a fourth prop to this component.

- [ ] **Step 1: Write the `Board` component**

Create `frontend/src/Board.jsx`:

```jsx
const CELL_LABELS = [
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

function Board({ squares, isOver, onPlay }) {
  return (
    <div className="board mx-auto">
      {squares.map((square, index) => (
        <button
          key={index}
          type="button"
          className="board-cell"
          onClick={() => onPlay(index)}
          disabled={Boolean(square) || isOver}
          aria-label={`${CELL_LABELS[index]}, ${square ?? 'empty'}`}
        >
          {square}
        </button>
      ))}
    </div>
  );
}

export default Board;
```

Two things worth naming, since this is the React-learning phase:

- **`key` on a mapped list.** React needs a stable identity per item to know which DOM node to reuse when a list changes. Using the array index is normally an anti-pattern — but that is only true for lists that get reordered, inserted into, or filtered, where index-to-item mapping shifts. This list is exactly nine cells that never move, so the index *is* the stable identity and is the correct key here.
- **This component holds no state.** It receives `squares` and reports clicks through `onPlay`. That is *props down, callbacks up*: the child announces what happened, the parent decides what it means. It replaces the form POST and full server re-render you would write in Jinja.

- [ ] **Step 2: Replace `App.jsx` with the game**

Replace the entire contents of `frontend/src/App.jsx`:

```jsx
import { useState } from 'react';
import Board from './Board.jsx';
import { calculateWinner } from './game.js';

const EMPTY_BOARD = Array(9).fill(null);

function App() {
  const [squares, setSquares] = useState(EMPTY_BOARD);

  const winner = calculateWinner(squares);
  const played = squares.filter((square) => square !== null).length;
  const isDraw = !winner && played === squares.length;
  const isOver = Boolean(winner) || isDraw;
  const nextPlayer = played % 2 === 0 ? 'X' : 'O';

  function handlePlay(index) {
    if (squares[index] || isOver) {
      return;
    }
    const next = squares.slice();
    next[index] = nextPlayer;
    setSquares(next);
  }

  let status;
  if (winner) {
    status = `${winner.player} wins!`;
  } else if (isDraw) {
    status = 'Draw';
  } else {
    status = `${nextPlayer} to play`;
  }

  return (
    <main className="container py-5 text-center">
      <h1 className="mb-4">TicTacTooGood</h1>
      <p className="fs-4 mb-4" aria-live="polite">
        {status}
      </p>
      <Board squares={squares} isOver={isOver} onPlay={handlePlay} />
      <button
        type="button"
        className="btn btn-primary mt-4"
        onClick={() => setSquares(EMPTY_BOARD)}
      >
        New Game
      </button>
    </main>
  );
}

export default App;
```

Note what is **not** stored: there is no `xIsNext` state and no `winner` state. Both are computed from `squares` on every render. This is *derived state*, the phase's central React idea — the component body is a view function that re-runs whenever state changes, so anything computable from state belongs in the body, not in another `useState`. Storing them would mean three values that must be updated in lockstep, and a bug the first time one update is missed.

`squares.slice()` copies before writing. React compares the old and new values to decide whether to re-render; mutating the existing array in place would leave the reference identical and the screen stale.

The `/api/hello` fetch is gone — the game replaces it. The backend route itself stays, unchanged, as a check that the compose wiring still works until Phase 2 gives the backend real work.

- [ ] **Step 3: Add the grid CSS**

Append to `frontend/src/index.css`:

```css
.board {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
  width: min(90vmin, 400px);
  aspect-ratio: 1;
}

.board-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  border: 2px solid #dee2e6;
  border-radius: 0.5rem;
  font-size: clamp(2rem, 12vmin, 4rem);
  font-weight: 700;
  line-height: 1;
  color: #212529;
}

.board-cell:enabled:hover {
  background: #f8f9fa;
  border-color: #adb5bd;
}

.board-cell:disabled {
  opacity: 1;
}
```

`aspect-ratio: 1` with `width: min(90vmin, 400px)` keeps the board square and fits any viewport without a single media query. The `:disabled { opacity: 1 }` override matters: browsers grey out disabled buttons by default, which would fade every mark the moment it is played.

- [ ] **Step 4: Format and lint**

Run from `frontend/`:

```bash
npx prettier --write src/App.jsx src/Board.jsx src/index.css
npm run lint
```

Expected: oxlint exits 0 with no findings. Pay attention to any `react/rules-of-hooks` finding — that rule is the reason oxlint is here.

- [ ] **Step 5: Verify the tests still pass**

Run from `frontend/`:

```bash
npm test
```

Expected: PASS — Task 1's 7 tests, still green.

- [ ] **Step 6: Verify in the browser**

Run from the repository root:

```bash
docker compose up
```

Open `http://localhost:5173` and confirm all of the following:

1. A 3x3 grid renders, square, centred, with "X to play" above it.
2. Clicking an empty cell places an X; the status changes to "O to play"; the next click places an O.
3. A played cell cannot be clicked again.
4. Winning three in a row changes the status to "X wins!" (or "O wins!") and every remaining cell becomes unclickable.
5. Filling the board with no winner shows "Draw".
6. "New Game" clears the board and the status returns to "X to play".
7. Tab moves focus between cells with a visible focus ring, and Enter or Space plays the focused cell.
8. Narrowing the browser window keeps the board square and fully visible.

- [ ] **Step 7: Stop — do not commit**

Leave the changes unstaged for the user to review and commit.

---

## Task 3: Win line

Draws a single line across the three winning cells.

**Files:**
- Modify: `frontend/src/Board.jsx` (add the `winningLine` prop and the SVG)
- Modify: `frontend/src/App.jsx` (pass the winning line down)
- Modify: `frontend/src/index.css` (position the overlay, style the stroke)

**Interfaces:**
- Consumes: `Board` from Task 2, and the `.line` array from Task 1's `calculateWinner` return value.
- Produces: nothing further; this is the last task in the phase.

- [ ] **Step 1: Pass the winning line into `Board`**

In `frontend/src/App.jsx`, add one prop to the `Board` element:

```jsx
      <Board
        squares={squares}
        winningLine={winner?.line}
        isOver={isOver}
        onPlay={handlePlay}
      />
```

`winner?.line` is optional chaining: it yields `undefined` when `winner` is
`null`, instead of throwing. No other change to `App.jsx`.

- [ ] **Step 2: Render the SVG overlay in `Board`**

In `frontend/src/Board.jsx`, add `winningLine` to the destructured props and render the SVG after the cells. The component becomes:

```jsx
const CELL_LABELS = [
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

/** Maps a cell index to the centre of that cell in the SVG's 3x3 coordinate space. */
const cellCentre = (index) => ({
  x: (index % 3) + 0.5,
  y: Math.floor(index / 3) + 0.5,
});

function Board({ squares, winningLine, isOver, onPlay }) {
  const start = winningLine && cellCentre(winningLine[0]);
  const end = winningLine && cellCentre(winningLine[2]);

  return (
    <div className="board mx-auto">
      {squares.map((square, index) => (
        <button
          key={index}
          type="button"
          className="board-cell"
          onClick={() => onPlay(index)}
          disabled={Boolean(square) || isOver}
          aria-label={`${CELL_LABELS[index]}, ${square ?? 'empty'}`}
        >
          {square}
        </button>
      ))}
      {winningLine && (
        <svg className="win-line" viewBox="0 0 3 3" aria-hidden="true">
          <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} />
        </svg>
      )}
    </div>
  );
}

export default Board;
```

The `viewBox` is three units square and the board is three cells square, so a
cell's centre is just its column plus a half and its row plus a half — no
scaling arithmetic, and all eight winning lines including both diagonals fall
out of the same two expressions with no special cases.

`{winningLine && (...)}` is React's conditional rendering: when the left side
is falsy React renders nothing. It is the `{% if %}` of Jinja, written as an
ordinary JavaScript expression because JSX has no template language of its own.

The SVG is `aria-hidden` because it is decorative — the status line already
announces the winner to a screen reader.

- [ ] **Step 3: Position and style the line**

Append to `frontend/src/index.css`:

```css
.win-line {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.win-line line {
  stroke: #dc3545;
  stroke-width: 0.08;
  stroke-linecap: round;
}
```

and add one declaration to the existing `.board` rule so the absolute overlay
positions against the grid:

```css
.board {
  position: relative;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
  width: min(90vmin, 400px);
  aspect-ratio: 1;
}
```

`position: absolute` takes the SVG out of the grid's flow, so it overlays the
cells instead of becoming a tenth grid item. `pointer-events: none` stops it
swallowing clicks meant for the cells beneath it — without it, the line would
block part of the board. Stroke width is in viewBox units, so `0.08` is 8% of
a cell and scales with the board.

- [ ] **Step 4: Format and lint**

Run from `frontend/`:

```bash
npx prettier --write src/App.jsx src/Board.jsx src/index.css
npm run lint
```

Expected: oxlint exits 0 with no findings.

- [ ] **Step 5: Verify the tests still pass**

Run from `frontend/`:

```bash
npm test
```

Expected: PASS — 7 tests, 0 failures.

- [ ] **Step 6: Verify in the browser**

With `docker compose up` running, open `http://localhost:5173` and confirm:

1. Winning a **row** draws a horizontal line through the three winning cells.
2. Winning a **column** draws a vertical line through them.
3. Winning the **top-left to bottom-right diagonal** draws a line corner to corner.
4. Winning the **top-right to bottom-left diagonal** draws the opposite diagonal.
5. The line ends at the centres of the outer winning cells, not at the board edge.
6. Clicking "New Game" removes the line.
7. A draw draws no line at all.
8. The line stays correctly aligned when the browser window is resized.

- [ ] **Step 7: Stop — do not commit**

Leave the changes unstaged for the user to review and commit. This completes Phase 1.

---

## Phase 1 done means

- Two people can play a full hotseat game in the browser.
- The turn indicator, win message, and draw message are all correct.
- A line is drawn across the winning three cells, for all eight winning lines.
- New Game resets the board.
- The board is responsive, keyboard-playable, and screen-reader-announced.
- `npm test` and `npm run lint` both pass.
- The backend is byte-for-byte unchanged.
