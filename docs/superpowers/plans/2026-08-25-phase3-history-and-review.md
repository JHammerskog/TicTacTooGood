# Phase 3: History, Review and Dark Mode — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the game a past — every position navigable, bad moves named and takeable-back, finished games reviewed — and make the app dark by default.

**Architecture:** One state change carries the phase: `squares` stops being state and becomes `history[cursor]`. Navigation, take-back, review and (in Phase 4) tutorials are all reads or writes against that pair. The history mechanics live in `game.js` as pure functions so they are testable under the existing `node --test`. No backend change is expected at all.

**Tech Stack:** React 19, Vite, Bootstrap 5.3 (`data-bs-theme`), Web Audio API, oxlint, Prettier, `node --test`. Backend untouched: Python 3.14, Flask, Pydantic, pytest, Ruff, uv.

**Spec:** `docs/superpowers/specs/2026-08-25-phase3-history-and-review-design.md`

## Global Constraints

- **Never run git commands that write state** (`add`, `commit`, `branch`, `push`, `stash`, `checkout`, `restore`). This project's CLAUDE.md reserves all of them for the user. Read-only git is fine. Every task ends with changes left unstaged.
- **JavaScript:** ES6+, semicolons, Prettier defaults (80-col print width). Run `npx prettier --write` on every file you touch and confirm `npx prettier --check src/*.jsx src/*.js src/*.css` passes before reporting.
- **`npm run lint` must emit nothing at all** — not even a warning.
- **JSDoc on every exported function in `game.js`**, matching the style already there (description, `@param` with types, `@returns` with type and meaning).
- **Bootstrap 5 utilities first**; custom CSS only for what Bootstrap cannot express, in `index.css`, reusing the `var(--bs-*)` tokens already used there.
- **Accessibility:** colour is never the only channel; controls are keyboard-reachable; mutually exclusive choices are radio groups, binary ones are switches.
- **No new dependencies.** Web Audio and `localStorage` are platform APIs. No component test framework — that decision is recorded in the Phase 2b spec.
- **The backend must not change.** `cd backend && uv run pytest` must still report **61 passed** at the end of every task. If you believe a backend change is needed, stop and report it — the spec says that is a signal the design is wrong.
- Frontend commands run in `frontend/`; `node_modules` is present. Docker containers may be running with hot reload.

## File Structure

| File | Responsibility |
|---|---|
| `frontend/src/game.js` | Pure rules and history mechanics. Gains `playInHistory`, `lastMoveIndex`, `judgeMove`. |
| `frontend/src/Game.jsx` | Owns `history` + `cursor`, the replay target, critique state and move records. |
| `frontend/src/useAnalysis.js` | Gains a request timeout and echoes the board its analysis describes. |
| `frontend/src/MoveList.jsx` (new) | The move list behind the Moves button. |
| `frontend/src/TeachingDial.jsx` (new) | Moved out of `TeachingPanel.jsx`, which the start screen imported oddly. |
| `frontend/src/ThemeControls.jsx` (new) | The shared header row: theme toggle and mute. |
| `frontend/src/sound.js` (new) | The Web Audio pencil scratch. |
| `frontend/src/TeachingPanel.jsx` | Gains the critique banner and the review card. |
| `frontend/src/App.jsx` | Renders the header row; owns theme and mute settings. |
| `frontend/src/index.css` | Dark-mode checks; any tint adjustments the measurements demand. |
| `backend/tests/test_opponent.py` | One docstring fix. The only backend file this phase touches. |

**Task order.** Task 1 is the state change everything rests on and must land first. Tasks 2 and 9 are independent and could run any time. Tasks 3–8 build on Task 1 in order.

---

### Task 1: History and cursor

`squares` stops being state. This task changes only where the board comes from; no new controls appear and the game must behave exactly as it does today.

**Files:**
- Modify: `frontend/src/game.js`
- Modify: `frontend/src/Game.jsx`
- Test: `frontend/src/game.test.js`

**Interfaces:**
- Consumes: `calculateWinner`, `isOver`, `nextPlayer`, `playedCount` from `game.js`.
- Produces:
  - `playInHistory(history, cursor, index, mark) -> { history, cursor }`
  - `lastMoveIndex(previous, current) -> number | null`
  - `Game` holds `history` and `cursor`; `squares` and `lastMove` are derived.

- [ ] **Step 1: Write the failing tests**

Append to `frontend/src/game.test.js`, adding `playInHistory` and `lastMoveIndex` to the existing import list from `./game.js`.

```js
test('playing at the tip appends to history', () => {
  const empty = Array(9).fill(null);
  const first = playInHistory([empty], 0, 4, 'X');
  assert.equal(first.history.length, 2);
  assert.equal(first.cursor, 1);
  assert.equal(first.history[1][4], 'X');
  // The earlier position is untouched, not mutated.
  assert.equal(first.history[0][4], null);
});

test('playing from the past discards the future', () => {
  const empty = Array(9).fill(null);
  let state = playInHistory([empty], 0, 4, 'X');
  state = playInHistory(state.history, state.cursor, 0, 'O');
  state = playInHistory(state.history, state.cursor, 8, 'X');
  assert.equal(state.history.length, 4);

  // Step back to just after X's first move, then play something else.
  const branched = playInHistory(state.history, 1, 2, 'O');
  assert.equal(branched.history.length, 3);
  assert.equal(branched.cursor, 2);
  assert.equal(branched.history[2][2], 'O');
  assert.equal(branched.history[2][8], null);
});

test('playing an occupied cell changes nothing', () => {
  const empty = Array(9).fill(null);
  const state = playInHistory([empty], 0, 4, 'X');
  const again = playInHistory(state.history, state.cursor, 4, 'O');
  assert.equal(again.history, state.history);
  assert.equal(again.cursor, state.cursor);
});

test('finds which cell changed between two positions', () => {
  const before = [...'X...O....'].map((c) => (c === '.' ? null : c));
  const after = [...'X.X.O....'].map((c) => (c === '.' ? null : c));
  assert.equal(lastMoveIndex(before, after), 2);
});

test('there is no last move at the start of a game', () => {
  const empty = Array(9).fill(null);
  assert.equal(lastMoveIndex(undefined, empty), null);
  assert.equal(lastMoveIndex(empty, empty), null);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && npm test`
Expected: FAIL — `playInHistory is not a function`.

- [ ] **Step 3: Add the functions to `game.js`**

```js
/**
 * Plays a move, returning the new history and cursor.
 *
 * Playing from a position you have navigated back to discards everything after
 * it: the game continues from there rather than branching. That is one
 * expression rather than three behaviours — it is also what disables Forward
 * and empties the visible move list.
 *
 * @param {Array<Array<'X' | 'O' | null>>} history - Every position so far.
 * @param {number} cursor - Which position is on screen.
 * @param {number} index - The cell to play.
 * @param {'X' | 'O'} mark - Whose move it is.
 * @returns {{ history: Array<Array<'X' | 'O' | null>>, cursor: number }} The
 *   new state, or the arguments unchanged if the cell is already occupied.
 */
export function playInHistory(history, cursor, index, mark) {
  const board = history[cursor];
  if (board[index] !== null) {
    return { history, cursor };
  }
  const next = board.slice();
  next[index] = mark;
  return { history: [...history.slice(0, cursor + 1), next], cursor: cursor + 1 };
}

/**
 * Finds the cell that changed between two consecutive positions.
 *
 * This replaces the `lastMove` state Phase 1 had to store: with a history the
 * answer is derivable, so the highlight follows the cursor while navigating
 * instead of being stuck on the most recent move played.
 *
 * @param {Array<'X' | 'O' | null> | undefined} previous - The position before.
 * @param {Array<'X' | 'O' | null> | undefined} current - The position now.
 * @returns {number | null} The changed cell, or null at the start of a game.
 */
export function lastMoveIndex(previous, current) {
  if (!previous || !current) {
    return null;
  }
  for (let index = 0; index < current.length; index += 1) {
    if (previous[index] !== current[index]) {
      return index;
    }
  }
  return null;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd frontend && npm test`
Expected: PASS, 30 tests (25 existing plus the 5 above).

- [ ] **Step 5: Switch `Game.jsx` to history**

Replace the two state declarations and the derived values at the top of the component:

```jsx
  const [history, setHistory] = useState([EMPTY_BOARD]);
  const [cursor, setCursor] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  // Locked when the game starts. See `toggleWhoStarts` for why this is state
  // rather than a value derived from settings.computerFirst.
  const [humanMark, setHumanMark] = useState(
    settings.computerFirst ? 'O' : 'X',
  );

  const squares = history[cursor];
  const lastMove = lastMoveIndex(history[cursor - 1], squares);
```

Delete the `const [lastMove, setLastMove] = useState(null);` line and its comment — the comment says the value cannot be derived, which this task makes untrue.

Replace `playAt`:

```jsx
  function playAt(index) {
    if (squares[index] !== null || over) {
      return;
    }
    const next = playInHistory(history, cursor, index, player);
    setHistory(next.history);
    setCursor(next.cursor);
  }
```

Replace `startNewGame`:

```jsx
  function startNewGame() {
    // A fresh array, not the EMPTY_BOARD constant: identity is what
    // re-triggers useAnalysis's fetch (and re-rolls a perfect opponent's
    // random opening), and setState bails out on an identical reference.
    setHistory([Array(9).fill(null)]);
    setCursor(0);
    setHoveredIndex(null);
    setHumanMark(settings.computerFirst ? 'O' : 'X');
  }
```

Add `lastMoveIndex` and `playInHistory` to the `./game.js` import. Everything else in the component is unchanged — `winner`, `over`, `player`, `played`, the computer's effect and all the JSX still read `squares`, which now comes from `history[cursor]`.

- [ ] **Step 6: Verify nothing changed behaviourally**

Run: `cd frontend && npm run lint && npm test && npx prettier --check src/*.jsx src/*.js src/*.css && npm run build`, then delete `frontend/dist`.
Run: `cd ../backend && uv run pytest -q` — must still report 61 passed.

Expected: everything clean. This task adds no visible feature; the game must play exactly as before, including the last-move yellow tint, the computer opponent, and New Game.

- [ ] **Step 7: Stop — do not commit**

Leave the changes unstaged for the user to review and commit.

---

### Task 2: Give `useAnalysis` a timeout and a board echo

Two pieces of debt carried from Phase 2b, both in one file, both independent of the history work.

**Files:**
- Modify: `frontend/src/useAnalysis.js`
- Modify: `frontend/src/Game.jsx`

**Interfaces:**
- Produces: `useAnalysis` returns `{ data, loading, error, retry }` where `data`, when present, carries a `board` field naming the position it describes.

**Why each matters.** A backend that *hangs* rather than failing currently leaves a permanent spinner and no Retry, because Retry renders only on an error. And because `data` is cleared by an effect rather than derived, one painted frame shows the new board carrying the previous position's verdicts — measured at roughly 16ms, invisible by eye but real, and it is exactly the "annotation shown in a state where it is wrong" case this app must not have.

- [ ] **Step 1: Add the timeout**

In `useAnalysis.js`, inside the effect, after `const controller = new AbortController();`:

```js
    // A hung backend is not a failed one: without this the promise never
    // settles, so `loading` stays true forever and the Retry button — which
    // renders only on an error — never appears.
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);
```

Add the constant above the hook:

```js
/** How long to wait before treating a silent backend as a failure. */
const REQUEST_TIMEOUT_MS = 8000;
```

In the `.catch`, distinguish the two aborts — the cleanup abort must stay silent, the timeout must surface:

```js
      .catch((error) => {
        if (error.name === 'AbortError') {
          if (timedOut) {
            setState({
              data: null,
              loading: false,
              error: 'The server did not respond.',
            });
          }
          return;
        }
        setState({ data: null, loading: false, error: error.message });
      });
```

And clear the timer in the cleanup:

```js
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
```

- [ ] **Step 2: Echo the board**

Still in `useAnalysis.js`, change the success handler so the stored data names the board it describes:

```js
      .then((data) => setState({ data: { ...data, board }, loading: false, error: null }))
```

- [ ] **Step 3: Ignore analysis that does not match the board on screen**

In `Game.jsx`, immediately after the `useAnalysis` call:

```jsx
  // Guard against the one frame where `data` still describes the previous
  // position: it is cleared by an effect, which runs after the commit that
  // already painted the new board.
  const analysis =
    data && data.board === squares ? data : null;
```

Then replace every other use of `data` in the component with `analysis` — the `Board`'s `moves` prop, the `TeachingPanel`'s `analysis` prop, and the computer's effect (`analysis?.suggested`, and `analysis` in its dependency array).

**Note on the comparison:** `data.board` is the exact array `useAnalysis` was given, and `squares` is `history[cursor]`, so `===` is the right test — these are the same object when they match, and different objects otherwise. Do not use a deep comparison; two different positions could never be `===` anyway, and a deep compare would wrongly match a repeated position reached by a different route.

- [ ] **Step 4: Verify**

Run: `cd frontend && npm run lint && npm test && npx prettier --check src/*.jsx src/*.js src/*.css && npm run build`, then delete `frontend/dist`.

Then verify the timeout by hand. With the containers running, add a temporary delay to the backend route (a `time.sleep(30)` at the top of `analyse` in `backend/app.py`), rebuild the backend, play a move, and confirm that after ~8 seconds the "Analysis unavailable: The server did not respond." alert appears with a working Retry. **Then remove the `time.sleep` and rebuild** — leaving it in place would break every backend test. Confirm `cd backend && uv run pytest -q` reports 61 passed afterwards.

- [ ] **Step 5: Stop — do not commit**

Leave the changes unstaged for the user to review and commit.

---

### Task 3: Back, Forward, and the replay animation

**Files:**
- Modify: `frontend/src/Game.jsx`

**Interfaces:**
- Consumes: `history`, `cursor` from Task 1; `analysis` from Task 2.
- Produces: `Game` holds a replay `target`; derived `atTip`, `replaying` and `live`; `goTo(ply)` used by this task's buttons and by Tasks 4, 7 and 8.

**One mechanism, not two.** Back and Forward do not set the cursor directly. They set a *target*, and an effect walks the cursor toward it one ply at a time. The move list in Task 4 sets a target several plies away and reuses this exact code; so does the review's "go to this move" in Task 8.

- [ ] **Step 1: Add the target and the stepping effect**

In `Game.jsx`, add beside the other state:

```jsx
  // Where navigation is heading. The cursor walks toward it a ply at a time so
  // a jump replays the moves between instead of snapping.
  const [target, setTarget] = useState(null);
```

Add the constant near `THINKING_MS`:

```jsx
/** Gap between plies while replaying, so a jump reads as a sequence. */
const REPLAY_STEP_MS = 180;
```

Add the effect below the computer's effect:

```jsx
  useEffect(() => {
    if (target === null || target === cursor) {
      return undefined;
    }
    const step = target > cursor ? 1 : -1;
    const timer = setTimeout(() => setCursor(cursor + step), REPLAY_STEP_MS);
    return () => clearTimeout(timer);
  }, [target, cursor]);
```

Note it does **not** clear `target` on arrival. Doing so would mean calling `setState` from an effect purely to tidy up, and the value is harmless once reached — `replaying` below is false the moment the cursor matches. What matters is clearing it when the game moves on, which Step 2 does.

- [ ] **Step 2: Derive the three states, and clear the target when play resumes**

Add after `const squares = history[cursor];`:

```jsx
  const atTip = cursor === history.length - 1;
  const replaying = target !== null && target !== cursor;
  // "Settled and live": the position on screen is the real one, and nothing is
  // mid-flight. The computer may only move in this state. Task 7 adds a third
  // condition here.
  const live = atTip && !replaying;
```

In `playAt`, clear the target before updating history — otherwise a stale target left over from navigating backwards would immediately drag the cursor away from the move just played:

```jsx
  function playAt(index) {
    if (squares[index] !== null || over) {
      return;
    }
    setTarget(null);
    const next = playInHistory(history, cursor, index, player);
    setHistory(next.history);
    setCursor(next.cursor);
  }
```

Add `setTarget(null);` to `startNewGame` as well.

- [ ] **Step 3: Hold the computer unless the game is settled and live**

Change the computer's effect guard from `if (!isComputerTurn || analysis?.suggested == null)` to:

```jsx
    if (!isComputerTurn || !live || analysis?.suggested == null) {
```

and add `live` to its dependency array.

**Why this is required, not defensive:** `isComputerTurn` derives from `squares`, which is now `history[cursor]`. Navigating back to a position where the computer was to move would otherwise fire this effect, and the computer would play — truncating the game you were trying to review. It is reachable by pressing Back twice in any computer game.

- [ ] **Step 4: Add the controls and disable the board while replaying**

Add a navigation row directly beneath the board, inside the centre column:

```jsx
          <div className="d-flex justify-content-center gap-2 mt-3">
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={() => setTarget(cursor - 1)}
              disabled={cursor === 0 || replaying}
            >
              ← Back
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={() => setTarget(cursor + 1)}
              disabled={atTip || replaying}
            >
              Forward →
            </button>
          </div>
```

Change the `Board`'s `disabled` prop to include a replay in flight:

```jsx
            disabled={over || isComputerTurn || replaying}
```

**Back moves one ply, not one turn.** In a computer game that means two presses to reach your own previous decision — once past the computer's reply, once past your move. One ply is what the move list and the review both address, so making the button mean something different would give the phase two notions of "a step".

- [ ] **Step 5: Verify**

Run: `cd frontend && npm run lint && npm test && npx prettier --check src/*.jsx src/*.js src/*.css && npm run build`, then delete `frontend/dist`. Backend: `cd ../backend && uv run pytest -q` — 61 passed.

Browser checks, with the containers up:
- Play several moves, press Back repeatedly: the board steps backwards, the yellow last-move tint follows the cursor rather than staying on the final move, and the annotations change with each position.
- Forward walks back up and is disabled at the tip; Back is disabled at the start.
- In a computer game, press Back twice and wait: the computer must **not** move. Then play a different cell — the future is discarded and the computer replies to the new position.
- Both buttons are disabled while a replay is animating.

- [ ] **Step 6: Stop — do not commit**

Leave the changes unstaged for the user to review and commit.

---

### Task 4: The move list

**Files:**
- Create: `frontend/src/MoveList.jsx`
- Modify: `frontend/src/game.js`
- Modify: `frontend/src/Game.jsx`
- Test: `frontend/src/game.test.js`

**Interfaces:**
- Consumes: `history`, `cursor`, `setTarget` from Task 3; `CELL_NAMES` from `game.js`.
- Produces: `moveLabels(history) -> string[]`; `MoveList({ labels, cursor, onJump })`.

- [ ] **Step 1: Write the failing test**

Append to `frontend/src/game.test.js`, adding `moveLabels` to the import list.

```js
test('labels each position in a game', () => {
  const empty = Array(9).fill(null);
  let state = playInHistory([empty], 0, 4, 'X');
  state = playInHistory(state.history, state.cursor, 0, 'O');
  assert.deepEqual(moveLabels(state.history), [
    'Game start',
    '1. X centre',
    '2. O top left',
  ]);
});

test('an empty game has only its start', () => {
  assert.deepEqual(moveLabels([Array(9).fill(null)]), ['Game start']);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npm test`
Expected: FAIL — `moveLabels is not a function`.

- [ ] **Step 3: Add `moveLabels` to `game.js`**

```js
/**
 * Names each position in a history, for the move list.
 *
 * @param {Array<Array<'X' | 'O' | null>>} history - Every position so far.
 * @returns {string[]} One label per position: "Game start", then
 *   "1. X centre" and so on, numbered by ply.
 */
export function moveLabels(history) {
  return history.map((board, ply) => {
    if (ply === 0) {
      return 'Game start';
    }
    const index = lastMoveIndex(history[ply - 1], board);
    return `${ply}. ${board[index]} ${CELL_NAMES[index]}`;
  });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd frontend && npm test`
Expected: PASS, 32 tests.

- [ ] **Step 5: Create `MoveList.jsx`**

```jsx
/**
 * The list of positions in the current game. Hidden behind a button rather
 * than always on screen: it is reference material, not something you watch.
 */
function MoveList({ labels, cursor, onJump }) {
  return (
    <div className="list-group text-start">
      {labels.map((label, ply) => (
        <button
          key={ply}
          type="button"
          className={
            ply === cursor
              ? 'list-group-item list-group-item-action active'
              : 'list-group-item list-group-item-action'
          }
          aria-current={ply === cursor ? 'true' : undefined}
          onClick={() => onJump(ply)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export default MoveList;
```

These rows **are** buttons, unlike the teaching panel's rows: jumping to a position is a real action, so the element that does it should be one. That is the same reasoning that kept `MoveRow` a plain `<li>` — there, clicking would have done nothing.

- [ ] **Step 6: Wire it into the left column**

In `Game.jsx`, add state for the disclosure and compute the labels:

```jsx
  const [showMoves, setShowMoves] = useState(false);
  const labels = moveLabels(history);
```

Replace the reserved left column — currently `<div className="col-lg-3 d-none d-lg-block" aria-hidden="true" />` — with:

```jsx
        <div className="col-lg-3">
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm mb-2"
            aria-expanded={showMoves}
            onClick={() => setShowMoves((shown) => !shown)}
          >
            {showMoves ? 'Hide moves' : `Moves (${history.length - 1})`}
          </button>
          {showMoves && (
            <MoveList labels={labels} cursor={cursor} onJump={setTarget} />
          )}
        </div>
```

`onJump` is `setTarget`, so a jump replays the intervening moves through Task 3's effect rather than snapping — no new mechanism.

Import `MoveList` and add `moveLabels` to the `game.js` import.

- [ ] **Step 7: Verify**

Run the four frontend commands and the backend suite as in Task 3.

Browser checks: the Moves button shows the ply count and toggles the list; the current position is marked; clicking an earlier entry replays backwards to it a ply at a time; playing a move from there truncates the list; the button's count updates.

- [ ] **Step 8: Stop — do not commit**

Leave the changes unstaged for the user to review and commit.

---

### Task 5: Dark mode and the shared header

**Files:**
- Create: `frontend/src/ThemeControls.jsx`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/index.css` (only if the measurements in Step 4 demand it)

**Interfaces:**
- Produces: `ThemeControls({ theme, onTheme })`; `App` owns `theme` and applies it to the document.

**The app is dark unless the player says otherwise.** That is deliberately *not* `prefers-color-scheme`: the requirement is a dark app, not one that follows the operating system.

- [ ] **Step 1: Own the theme in `App.jsx`**

```jsx
const THEME_KEY = 'tictactoogood:theme';

/** Reads the stored theme, defaulting to dark. Storage can throw in a private
 *  window or when site data is blocked, so a failure falls back rather than
 *  taking the app down. */
function storedTheme() {
  try {
    return localStorage.getItem(THEME_KEY) ?? 'dark';
  } catch {
    return 'dark';
  }
}
```

Inside `App`:

```jsx
  const [theme, setTheme] = useState(storedTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-bs-theme', theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // A viewer who blocks storage still gets the theme, just not remembered.
    }
  }, [theme]);
```

Note `useState(storedTheme)` passes the function itself, not a call — React runs it once on mount instead of on every render.

**Also set the attribute before React renders at all.** The effect above runs after the first paint, so on its own every load shows a visible flash of the light theme — precisely the wrong first impression for an app whose default is dark. In `frontend/src/main.jsx`, before `createRoot(...).render(...)`:

```js
// Applied before the first paint; App's effect keeps it in step afterwards.
try {
  document.documentElement.setAttribute(
    'data-bs-theme',
    localStorage.getItem('tictactoogood:theme') ?? 'dark',
  );
} catch {
  document.documentElement.setAttribute('data-bs-theme', 'dark');
}
```

The duplication with `App` is deliberate and small: one call owns the first frame, the other owns every change after it. Add `frontend/src/main.jsx` to this task's file list.

**This effect is correct, unlike the one Phase 2b deliberately avoided.** `document.documentElement` is outside React: nothing in the component tree owns that attribute, so synchronising it is exactly what effects are for. The 2b case was different — it wanted to react to React's own state change, which belongs in the event handler.

Render the header above the screens, inside `<main>`:

```jsx
      <ThemeControls theme={theme} onTheme={setTheme} />
```

- [ ] **Step 2: Create `ThemeControls.jsx`**

```jsx
/**
 * The controls that belong to the app rather than to a game: they sit above
 * both screens and survive navigation between them.
 */
function ThemeControls({ theme, onTheme }) {
  const dark = theme === 'dark';
  return (
    <div className="d-flex justify-content-end gap-3 mb-2">
      <div className="form-check form-switch mb-0">
        <input
          className="form-check-input"
          type="checkbox"
          role="switch"
          id="theme-switch"
          checked={dark}
          onChange={() => onTheme(dark ? 'light' : 'dark')}
        />
        <label className="form-check-label small" htmlFor="theme-switch">
          Dark
        </label>
      </div>
    </div>
  );
}

export default ThemeControls;
```

Task 6 adds the mute switch beside it.

- [ ] **Step 3: Verify the app renders dark by default**

Run the four frontend commands. Then, in a browser with cleared site data, load the app and confirm it comes up dark, that the switch flips it to light, and that a reload keeps the choice.

- [ ] **Step 4: Measure the annotation colours in dark — do not eyeball this**

The three tints, the last-move yellow and the red win line were all chosen in earlier phases from `var(--bs-*)` tokens *on the assumption* that they adapt. Nothing ever set `data-bs-theme`, so that assumption has never been tested.

With teaching on "Every move" and a game in progress in dark mode, collect the computed colours and the contrast of the mark against its cell for every annotated cell, and for the win line against the board. Report the numbers in your report.

If any tinted cell's text contrast falls below **4.5:1**, add a dark-mode override in `index.css` under `[data-bs-theme='dark']` using the corresponding `--bs-*-border-subtle` or a darker token, and re-measure. Do not adjust colours that already pass — the tokens exist so the palette stays coherent.

- [ ] **Step 5: Lighthouse in both themes**

Run a Lighthouse pass in dark and in light. Accessibility and Best Practices must both stay at 100, as they were at the end of Phase 2b.

- [ ] **Step 6: Stop — do not commit**

Leave the changes unstaged for the user to review and commit.

---

### Task 6: The pencil sound

**Files:**
- Create: `frontend/src/sound.js`
- Modify: `frontend/src/ThemeControls.jsx`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/Game.jsx`

**Interfaces:**
- Produces: `playPencil()`; `App` owns `muted`; `Game` calls `playPencil()` on a move and on each replay step.

- [ ] **Step 1: Create `sound.js`**

```js
/**
 * A pencil scratch, synthesised rather than sampled: no audio file enters the
 * repo and nothing is downloaded. A scratch is essentially filtered noise with
 * a sharp attack, which the Web Audio API builds in a few nodes.
 */

/** Created lazily: browsers refuse to start audio without a user gesture, and
 *  every call here follows a click. */
let context = null;

function audioContext() {
  if (context === null) {
    context = new AudioContext();
  }
  return context;
}

/** Plays one scratch. Silently does nothing if audio is unavailable. */
export function playPencil() {
  let ctx;
  try {
    ctx = audioContext();
  } catch {
    return;
  }

  // Slight variation per move, so repeated moves do not sound mechanical.
  const duration = 0.09 + Math.random() * 0.05;
  const frames = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < frames; i += 1) {
    // Noise, faded out across the buffer: the graphite leaves the paper.
    samples[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1400 + Math.random() * 600;
  filter.Q.value = 0.8;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

  source.connect(filter).connect(gain).connect(ctx.destination);
  source.start();
  source.stop(ctx.currentTime + duration);
}
```

- [ ] **Step 2: Add mute to `App.jsx` and `ThemeControls.jsx`**

In `App.jsx`, alongside the theme, with the same storage guards:

```jsx
const MUTED_KEY = 'tictactoogood:muted';

function storedMuted() {
  try {
    return localStorage.getItem(MUTED_KEY) === 'true';
  } catch {
    return false;
  }
}
```

```jsx
  const [muted, setMuted] = useState(storedMuted);

  useEffect(() => {
    try {
      localStorage.setItem(MUTED_KEY, String(muted));
    } catch {
      // Not remembered; not fatal.
    }
  }, [muted]);
```

Pass `muted` and `onMuted` to `ThemeControls`, and `muted` to `Game`. Add a second switch to `ThemeControls` beside the theme one, labelled `Sound`, checked when **not** muted:

```jsx
      <div className="form-check form-switch mb-0">
        <input
          className="form-check-input"
          type="checkbox"
          role="switch"
          id="sound-switch"
          checked={!muted}
          onChange={() => onMuted(!muted)}
        />
        <label className="form-check-label small" htmlFor="sound-switch">
          Sound
        </label>
      </div>
```

- [ ] **Step 3: Sound the moves and the replay**

In `Game.jsx`, add a small helper and call it in the two places a mark appears or changes:

```jsx
  function scratch() {
    if (!muted) {
      playPencil();
    }
  }
```

Call `scratch()` in `playAt`, immediately after the guard passes, and inside the replay effect's timeout, next to `setCursor`:

```jsx
      const timer = setTimeout(() => {
        scratch();
        setCursor(cursor + step);
      }, REPLAY_STEP_MS);
```

Sounding every replay step is the point: flicking back through a game should sound like flicking through a notebook, not like one click.

- [ ] **Step 4: Verify**

Run the four frontend commands and the backend suite.

By hand: a move makes a scratch; holding Back through several plies makes a run of them; the Sound switch silences it and the setting survives a reload; with sound off, no `AudioContext` is ever constructed (check `window.AudioContext` usage via the Performance panel, or simply confirm no console warning about autoplay appears on a muted first load).

- [ ] **Step 5: Stop — do not commit**

Leave the changes unstaged for the user to review and commit.

---

### Task 7: Critique and take-back

**Files:**
- Modify: `frontend/src/game.js`
- Modify: `frontend/src/Game.jsx`
- Modify: `frontend/src/StartScreen.jsx`
- Test: `frontend/src/game.test.js`

**Interfaces:**
- Consumes: `analysis` (Task 2), `live` (Task 3).
- Produces: `judgeMove(analysis, index) -> { played, bestOutcome, alternatives } | null`; `settings.critique: boolean`; `Game` holds `critique`.

**The bar:** a move is flagged only when the outcome class worsens — a draw becomes a loss, or a win becomes a draw. A slower win is not flagged; nor is a non-optimal move that still draws. Flagging those trains the player to ignore the app.

- [ ] **Step 1: Write the failing tests**

Append to `frontend/src/game.test.js`, adding `judgeMove` to the import list. **These fixtures are the real endpoint's output for those two boards — do not alter the numbers.**

```js
// X to play on XX.OO.... — index 2 completes the top row.
const winAvailable = {
  moves: [
    { index: 2, outcome: 'win', distance: 0, rule: 'win', best: true },
    { index: 5, outcome: 'draw', distance: 4, rule: 'empty_side', best: false },
    { index: 6, outcome: 'loss', distance: 1, rule: 'empty_corner', best: false },
    { index: 7, outcome: 'loss', distance: 1, rule: 'block', best: false },
    { index: 8, outcome: 'loss', distance: 1, rule: 'empty_corner', best: false },
  ],
};

// O to play after X takes the centre — only the corners draw.
const afterCentre = {
  moves: [
    { index: 0, outcome: 'draw', distance: 7, rule: 'empty_corner', best: true },
    { index: 1, outcome: 'loss', distance: 5, rule: 'empty_side', best: false },
    { index: 2, outcome: 'draw', distance: 7, rule: 'empty_corner', best: true },
    { index: 3, outcome: 'loss', distance: 5, rule: 'empty_side', best: false },
    { index: 5, outcome: 'loss', distance: 5, rule: 'empty_side', best: false },
    { index: 6, outcome: 'draw', distance: 7, rule: 'empty_corner', best: true },
    { index: 7, outcome: 'loss', distance: 5, rule: 'empty_side', best: false },
    { index: 8, outcome: 'draw', distance: 7, rule: 'empty_corner', best: true },
  ],
};

test('flags a move that throws away a win', () => {
  const verdict = judgeMove(winAvailable, 5);
  assert.equal(verdict.played.outcome, 'draw');
  assert.equal(verdict.bestOutcome, 'win');
  assert.deepEqual(
    verdict.alternatives.map((move) => move.index),
    [2],
  );
});

test('flags a move that turns a draw into a loss', () => {
  const verdict = judgeMove(afterCentre, 1);
  assert.equal(verdict.played.outcome, 'loss');
  assert.equal(verdict.bestOutcome, 'draw');
  assert.deepEqual(
    verdict.alternatives.map((move) => move.index),
    [0, 2, 6, 8],
  );
});

test('stays quiet when the outcome is unchanged', () => {
  // Taking the win, and taking one of the four drawing corners.
  assert.equal(judgeMove(winAvailable, 2), null);
  assert.equal(judgeMove(afterCentre, 0), null);
});

test('a slower win is not a mistake', () => {
  const slower = {
    moves: [
      { index: 0, outcome: 'win', distance: 0, rule: 'win', best: true },
      { index: 1, outcome: 'win', distance: 4, rule: 'empty_side', best: false },
    ],
  };
  assert.equal(judgeMove(slower, 1), null);
});

test('nothing is judged without an analysis', () => {
  assert.equal(judgeMove(null, 4), null);
  assert.equal(judgeMove({ moves: [] }, 4), null);
  assert.equal(judgeMove(afterCentre, 4), null); // 4 is occupied: not a legal move
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd frontend && npm test`
Expected: FAIL — `judgeMove is not a function`.

- [ ] **Step 3: Add `judgeMove` to `game.js`**

```js
/** Outcomes ordered worst to best, for comparing what you got against what
 *  was available. */
const OUTCOME_RANK = { loss: 0, draw: 1, win: 2 };

/**
 * Decides whether a move threw something away.
 *
 * Only a change of outcome counts: draw to loss, or win to draw. Winning more
 * slowly is not an error, and neither is a non-optimal move that still draws —
 * flagging those would teach the player to ignore the warnings.
 *
 * Every optimal move shares one outcome, so the first is representative.
 *
 * @param {{ moves: Array<object> } | null} analysis - The analysis of the
 *   position the move was played in, or null if none had arrived.
 * @param {number} index - The cell that was played.
 * @returns {{ played: object, bestOutcome: string, alternatives: Array<object> }
 *   | null} The verdict, or null when the move cost nothing or cannot be judged.
 */
export function judgeMove(analysis, index) {
  const moves = analysis?.moves;
  if (!Array.isArray(moves) || moves.length === 0) {
    return null;
  }
  const played = moves.find((move) => move.index === index);
  const alternatives = moves.filter((move) => move.best);
  if (!played || alternatives.length === 0) {
    return null;
  }
  const bestOutcome = alternatives[0].outcome;
  if (OUTCOME_RANK[played.outcome] >= OUTCOME_RANK[bestOutcome]) {
    return null;
  }
  return { played, bestOutcome, alternatives };
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `cd frontend && npm test`
Expected: PASS, 37 tests.

- [ ] **Step 5: Add the setting and the switch**

`App.jsx`'s `DEFAULT_SETTINGS` gains `critique: true`.

In `StartScreen.jsx`, below the teaching dial, add a switch bound to `settings.critique`, labelled **Tell me when I slip** with the hint "Warns after a move that throws the game, and offers to take it back." Use the same `form-check form-switch` markup as the who-goes-first toggle in `Game.jsx`, and the functional updater form: `onChange((previous) => ({ ...previous, critique: !previous.critique }))`.

- [ ] **Step 6: Fetch the analysis whenever critique needs it**

In `Game.jsx`, the hook's `enabled` argument currently reads `teachingOn || isComputerTurn`. It becomes:

```jsx
    teachingOn || settings.critique || isComputerTurn,
```

Without this the critique would silently never fire with teaching off, because there would be no analysis to judge against.

- [ ] **Step 7: Raise the banner and hold the computer**

Add state and clear it wherever the game moves on:

```jsx
  const [critique, setCritique] = useState(null);
```

Clear it in `startNewGame`. Extend `live` — this is the third condition Task 3 predicted:

```jsx
  const live = atTip && !replaying && critique === null;
```

In `handleCellClick`, judge before playing. The analysis in hand describes the position being clicked in, so no request is needed:

```jsx
  function handleCellClick(index) {
    if (isComputerTurn) {
      return;
    }
    if (settings.critique) {
      setCritique(judgeMove(analysis, index));
    }
    playAt(index);
  }
```

Render the banner above the board row, beside the existing error alert:

```jsx
      {critique && (
        <div className="alert alert-warning text-start" role="alert">
          <p className="mb-2">
            That {critique.played.outcome === 'loss' ? 'loses the game' : 'gives up the win'}.{' '}
            {critique.alternatives.length === 1
              ? `${CELL_NAMES[critique.alternatives[0].index]} was the move — ${RULE_TEXT[critique.alternatives[0].rule]}.`
              : `${critique.alternatives.length} other squares held the ${critique.bestOutcome}.`}
          </p>
          <button
            type="button"
            className="btn btn-sm btn-warning me-2"
            onClick={() => {
              setCritique(null);
              setTarget(cursor - 1);
            }}
          >
            Take it back
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() => setCritique(null)}
          >
            Play on
          </button>
        </div>
      )}
```

Import `CELL_NAMES` and `RULE_TEXT` from `game.js`.

**Take-back does not erase the move.** It steps the cursor back, so Forward still replays the mistake for another look; it is discarded only when a different move is played from that position, by the ordinary truncation rule.

**Why the computer must be held:** with `critique` non-null, `live` is false, so the opponent's effect does not fire. Without that, it would answer while the banner was still open and taking your move back would leave its reply on the board.

- [ ] **Step 8: Verify**

Run the four frontend commands and the backend suite.

Browser checks:
- Against the fallible computer, deliberately ignore a block. The banner appears, the computer does **not** reply while it is open, Take it back returns the board, and Play on lets the computer answer.
- Play a merely non-optimal move that still draws — no banner.
- Turn the switch off: no banners at all, and the game still plays.
- With teaching off but critique on, the banner still works (this is what Step 6 buys).

- [ ] **Step 9: Stop — do not commit**

Leave the changes unstaged for the user to review and commit.

---

### Task 8: Move records and the review

**Files:**
- Modify: `frontend/src/Game.jsx`
- Modify: `frontend/src/TeachingPanel.jsx`

**Interfaces:**
- Consumes: `judgeMove` (Task 7), `history`/`cursor` (Task 1), `setTarget` (Task 3).
- Produces: `Game` holds `records`; `TeachingPanel` takes `records` and `onGoTo`.

Records are kept whether or not critique is switched on: the review is a separate feature, and a player may well want the post-mortem without being interrupted during play.

- [ ] **Step 1: Keep a record per human move**

In `Game.jsx`:

```jsx
  // One entry per human move, so the post-game review needs no refetching.
  // `judged` distinguishes "we looked and it was fine" from "no analysis had
  // arrived" — a move played faster than the network must not be reported as
  // correct.
  const [records, setRecords] = useState([]);
```

In `handleCellClick`, **replace** the critique block Task 7 added — the two would otherwise call `judgeMove` twice for the same click — with this, still before `playAt(index)`:

```jsx
    const mistake = judgeMove(analysis, index);
    setRecords((previous) => [
      ...previous.filter((record) => record.ply < cursor + 1),
      { ply: cursor + 1, index, mark: player, judged: analysis !== null, mistake },
    ]);
    if (settings.critique) {
      setCritique(mistake);
    }
```

The `filter` is what keeps records in step with a truncated history: branching from the past drops every record at or after the new ply. Clear `records` in `startNewGame`.

- [ ] **Step 2: Render the review**

`TeachingPanel` gains `records` and `onGoTo` props. Replace its game-over branch — currently the single `describeResult` heading — with the heading plus the turning points:

```jsx
  if (analysis.status !== 'in_progress') {
    const slips = records.filter((record) => record.mistake);
    const unjudged = records.filter((record) => !record.judged).length;
    return (
      <div className="text-start">
        <h2 className="fs-5">
          {describeResult(analysis.winner, vsComputer, humanMark)}
        </h2>
        {slips.length === 0 ? (
          <p className="text-body-secondary mb-0">
            No mistakes. You played it out correctly.
          </p>
        ) : (
          <>
            <h3 className="fs-6 mt-3">Where it went wrong</h3>
            <div className="list-group">
              {slips.map((record) => (
                <button
                  key={record.ply}
                  type="button"
                  className="list-group-item list-group-item-action"
                  onClick={() => onGoTo(record.ply)}
                >
                  <div>
                    Move {record.ply}: {CELL_NAMES[record.index]}
                  </div>
                  <div className="text-body-secondary small">
                    had a {record.mistake.bestOutcome}, this{' '}
                    {describeOutcome(
                      record.mistake.played.outcome,
                      record.mistake.played.distance,
                    )}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
        {unjudged > 0 && (
          <p className="text-body-secondary small mt-2 mb-0">
            {unjudged} move{unjudged === 1 ? '' : 's'} played before the analysis
            arrived and could not be checked.
          </p>
        )}
      </div>
    );
  }
```

Pass `records={records}` and `onGoTo={setTarget}` from `Game.jsx`. Because `onGoTo` is `setTarget`, clicking a turning point replays the board back to it through Task 3's effect — again, no new mechanism.

**"No mistakes" is worth saying out loud.** Against the perfect opponent a flawless game is a draw, and a draw with no warning would otherwise look like nothing happened.

- [ ] **Step 3: Verify**

Run the four frontend commands and the backend suite.

Browser checks:
- Lose a game to the fallible computer having made at least one flagged error: the review lists it, and clicking it walks the board back to that position with the annotations on.
- Draw against the perfect opponent playing well: "No mistakes."
- Branch mid-game (go back, play differently) and finish: the review must describe the game as actually played, with no records from the discarded line.
- In hotseat with teaching and critique both off, no requests are made and the review reports the result with no turning points — the documented consequence of the fetch rule, not a bug.

- [ ] **Step 4: Stop — do not commit**

Leave the changes unstaged for the user to review and commit.

---

### Task 9: Clear the remaining Phase 2b debt

Three small items, unrelated to each other, none behavioural except the radio groups.

**Files:**
- Create: `frontend/src/TeachingDial.jsx`
- Modify: `frontend/src/TeachingPanel.jsx`, `frontend/src/StartScreen.jsx`, `frontend/src/Game.jsx`
- Modify: `backend/tests/test_opponent.py`

- [ ] **Step 1: Move `TeachingDial` to its own file**

Cut `TeachingDial` and its `DIAL_OPTIONS` constant out of `TeachingPanel.jsx` into a new `frontend/src/TeachingDial.jsx` as the default export, keeping the JSDoc. Update the imports in `StartScreen.jsx` and `Game.jsx` to `import TeachingDial from './TeachingDial.jsx';`, and remove the now-unused named export from `TeachingPanel.jsx`.

The start screen was importing a dial from a file called Panel while having no panel on it.

- [ ] **Step 2: Make the two exclusive choosers real radio groups**

The teaching dial and the opponent chooser each render N buttons carrying `aria-pressed`, which models N independent toggles. The truth is "exactly one of three". Bootstrap's `btn-check` expresses that with radio inputs and looks identical.

In `TeachingDial.jsx`, replace the button group with:

```jsx
      <div className="btn-group" role="group">
        {DIAL_OPTIONS.map((option) => (
          <Fragment key={option.value}>
            <input
              type="radio"
              className="btn-check"
              name="teaching-mode"
              id={`teaching-${option.value}`}
              autoComplete="off"
              checked={option.value === value}
              onChange={() => onChange(option.value)}
            />
            <label
              className="btn btn-outline-primary"
              htmlFor={`teaching-${option.value}`}
            >
              {option.label}
            </label>
          </Fragment>
        ))}
      </div>
```

Import `Fragment` from `react`. Apply the same transformation to the opponent chooser in `StartScreen.jsx`, with `name="opponent"` and ids `opponent-${option.value}`, keeping its two-line label content.

Leave the who-goes-first, theme, sound and critique switches alone — those are genuine binary toggles and `role="switch"` is right for them.

**The `name` attributes must be unique per group** and must not collide, or the browser will treat the two groups as one.

- [ ] **Step 3: Fix the Python docstring**

In `backend/tests/test_opponent.py`, give `live_positions` an Args/Returns docstring in the project's style:

```python
def live_positions() -> list[Board]:
    """Collect the positions where the game is still going.

    Returns:
        Every reachable board that has no winner and at least one legal move.
    """
```

- [ ] **Step 4: Verify**

Run: `cd frontend && npm run lint && npm test && npx prettier --check src/*.jsx src/*.js src/*.css && npm run build`, then delete `frontend/dist`.
Run: `cd ../backend && uv run pytest -q && uv run ruff check . && uv run ruff format --check .` — 61 passed, no findings.

Browser checks: both choosers still look and behave exactly as before; keyboard arrow keys now move within each group, which is what a radio group buys; selecting one option in either group does not disturb the other.

Run a final Lighthouse pass in both themes — Accessibility and Best Practices must still be 100.

- [ ] **Step 5: Stop — do not commit**

Leave the changes unstaged for the user to review and commit. This completes Phase 3.
