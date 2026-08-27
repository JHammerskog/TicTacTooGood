# Phase 5: Minor Changes and Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the end-of-game review to the tutorial that teaches the trap the player just lost to, replace the README hero image, and make the tutorial commentary readable.

**Architecture:** Three independent changes. The first adds symmetry-independent position matching to `game.js`, a pure `findTrapLoss` to `tutorials.js`, and a block in the review panel wired through `Game` and `App` with in-memory once-per-session suppression. The second replaces one PNG and its alt text. The third adds one CSS class and removes `small` from prose that carries meaning.

**Tech Stack:** React 19 + Vite, Bootstrap 5.3 utilities, `node --test` for frontend tests, Flask + pytest + Ruff on the backend, `uv` for Python deps, Prettier + oxlint for JS.

**Spec:** `docs/superpowers/specs/2026-08-27-phase5-minor-improvements-design.md`

## Global Constraints

- **NEVER run git commands that write state** (`add`, `commit`, `branch`, `push`, `stash`, `reset`). The user handles all staging and commits. Every task ends by *reporting* what to commit, never by committing. Read-only git (`status`, `log`, `diff`) is fine.
- **Environment-modifying commands** (installs, `$PATH`/dotfile edits) — explain and hand to the user; do not auto-run.
- Baseline before any change: **54 frontend tests, 85 backend tests**, all passing.
- Frontend gates: `cd frontend && npm test && npm run lint && npx prettier --check src/ && npm run build`.
- Backend gates: `cd backend && uv run pytest && uv run ruff check . && uv run ruff format --check .`.
- JavaScript: ES6+, semicolons required, Prettier defaults (2-space indent). Run `npx prettier --write` on touched files before checking.
- Python: type hints on every function; triple-quoted docstrings with Args/Returns.
- Styling: Bootstrap 5 utilities first; custom CSS only for what Bootstrap does not cover.
- `frontend/src/tutorials.json` must not be edited in this phase at all.
- Tutorial prose is the repo owner's copy. Task 5 changes how the words are set; it must not change any word.
- Tutorials stay in **one fixed orientation**. Nothing here re-orients a tutorial.
- Comments explain *why*, not *what*. Match the density of the surrounding file.

---

### Task 1: Symmetry-independent position keys

**Files:**
- Modify: `frontend/src/game.js` (add after `isOver`, before the `other` export)
- Test: `frontend/src/game.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `SYMMETRIES: number[][]` (eight permutations of nine indices) and `positionKey(board: Array<'X'|'O'|null>): string`, both exported from `game.js`.

- [ ] **Step 1: Write the failing tests**

Add to the end of `frontend/src/game.test.js`. Add `SYMMETRIES` and `positionKey` to the existing `from './game.js'` import block, keeping it alphabetical (`positionKey` after `playInHistory`; `SYMMETRIES` after `RULE_TEXT`).

```js
const cells = (text) => [...text].map((c) => (c === '.' ? null : c));

test('positionKey is identical for all eight symmetries of a position', () => {
  const board = cells('O...X...X');
  const keys = SYMMETRIES.map((permutation) =>
    positionKey(permutation.map((index) => board[index])),
  );
  assert.equal(new Set(keys).size, 1);
});

test('positionKey separates positions that are not symmetries', () => {
  const keys = new Set([
    positionKey(cells('O...X...X')),
    positionKey(cells('X...O...X')),
    positionKey(cells('OX.X.....')),
  ]);
  assert.equal(keys.size, 3);
});

test('positionKey agrees with the keys the backend suite pins', () => {
  // These three literals are asserted in backend/tests/test_tutorials.py too.
  // They are the contract between the two languages: if either side's
  // symmetry code changes, one of the two suites fails.
  assert.equal(positionKey(cells('O...X...X')), '..O.X.X..');
  assert.equal(positionKey(cells('X...O...X')), '..X.O.X..');
  assert.equal(positionKey(cells('OX.X.....')), '.....X.XO');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && npm test`
Expected: FAIL — `SyntaxError: The requested module './game.js' does not provide an export named 'SYMMETRIES'`.

- [ ] **Step 3: Implement**

Add to `frontend/src/game.js`, immediately after `isOver`:

```js
/** Rotates a 3x3 grid's index labels a quarter turn clockwise. */
const rotate = (indices) => [6, 3, 0, 7, 4, 1, 8, 5, 2].map((i) => indices[i]);

/** Mirrors a 3x3 grid's index labels left to right. */
const mirror = (indices) => [2, 1, 0, 5, 4, 3, 8, 7, 6].map((i) => indices[i]);

/**
 * The square's eight symmetries, as index permutations: four rotations, each
 * also mirrored. Applying one to a board gives the same position seen from a
 * different angle.
 */
export const SYMMETRIES = (() => {
  const all = [];
  let indices = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  for (let turn = 0; turn < 4; turn += 1) {
    all.push(indices);
    all.push(mirror(indices));
    indices = rotate(indices);
  }
  return all;
})();

/**
 * A key identifying a position's shape rather than its exact cells.
 *
 * Two boards that are rotations or reflections of one another share a key, so a
 * trap the player met turned on its side still matches the taught one. The
 * marks are compared as they are: the tutorials' trapped player is always O, so
 * a real game's trap carries the same marks as the taught position.
 *
 * @param {Array<'X' | 'O' | null>} board - 9 cells.
 * @returns {string} The smallest of the board's eight renderings, with '.' for
 *   an empty cell — for example '..O.X.X..'.
 */
export function positionKey(board) {
  const marks = board.map((cell) => cell ?? '.');
  return SYMMETRIES.map((permutation) =>
    permutation.map((index) => marks[index]).join(''),
  ).sort()[0];
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd frontend && npm test`
Expected: PASS, 57 tests.

- [ ] **Step 5: Prove the tests have teeth**

Temporarily change `rotate`'s array to `[0, 1, 2, 3, 4, 5, 6, 7, 8]` (an identity, so the eight "symmetries" collapse to two). Run `npm test` and confirm the symmetry test FAILS. Restore the array and confirm PASS again.

- [ ] **Step 6: Gates**

Run: `cd frontend && npx prettier --write src/game.js src/game.test.js && npm run lint && npm test && npm run build`
Expected: all clean, 57 tests pass.

- [ ] **Step 7: Report, do not commit**

Tell the user: files changed are `frontend/src/game.js` and `frontend/src/game.test.js`; suggested subject line `Add symmetry-independent position keys`. Do not stage or commit anything.

---

### Task 2: Find the trap that beat the player

**Files:**
- Modify: `frontend/src/tutorials.js`
- Test: `frontend/src/game.test.js`

**Interfaces:**
- Consumes: `positionKey` and `SYMMETRIES` from Task 1; `nextPlayer` from `game.js`.
- Produces: `findTrapLoss({ history, records, humanMark, winner }): { tutorial, ply, rotated } | null`, exported from `tutorials.js`. Each attacking tutorial in `TUTORIALS` gains `trapKey: string`; `going-second` gains `trapKey: null`.

- [ ] **Step 1: Write the failing tests**

Add to `frontend/src/game.test.js`. Add `findTrapLoss` to the existing `from './tutorials.js'` import block. Reuse the `cells` helper added in Task 1.

```js
// A real Centre first loss. X (the computer) opens in the centre, the human
// answers in a corner, X takes the opposite corner — the trap — and the human
// plays a side, which loses. Ply 4 is the blunder; history[3] is the trap.
const centreFirstLoss = {
  history: [
    '.........',
    '....X....',
    'O...X....',
    'O...X...X',
    'OO..X...X',
    'OOX.X...X',
    'OOX.X.O.X',
    'OOX.XXO.X',
  ].map(cells),
  records: [
    { ply: 2, judged: true, mistake: null },
    { ply: 4, judged: true, mistake: { bestOutcome: 'draw' } },
    { ply: 6, judged: true, mistake: null },
  ],
  humanMark: 'O',
  winner: 'X',
};

test('findTrapLoss names the tutorial whose trap beat the player', () => {
  const found = findTrapLoss(centreFirstLoss);
  assert.equal(found.tutorial.id, 'centre-first');
  assert.equal(found.ply, 4);
  assert.equal(found.rotated, false);
});

test('findTrapLoss recognises the trap in every orientation', () => {
  const found = SYMMETRIES.map((permutation) =>
    findTrapLoss({
      ...centreFirstLoss,
      history: centreFirstLoss.history.map((board) =>
        permutation.map((index) => board[index]),
      ),
    }),
  );
  assert.ok(found.every((hit) => hit?.tutorial.id === 'centre-first'));
  // The taught orientation is reported as such; the turned ones are not.
  assert.ok(found.some((hit) => hit.rotated === false));
  assert.ok(found.some((hit) => hit.rotated === true));
});

test('findTrapLoss stays quiet unless the human lost', () => {
  assert.equal(findTrapLoss({ ...centreFirstLoss, winner: 'O' }), null);
  assert.equal(findTrapLoss({ ...centreFirstLoss, winner: null }), null);
});

test('findTrapLoss stays quiet in hotseat', () => {
  assert.equal(findTrapLoss({ ...centreFirstLoss, humanMark: null }), null);
});

test('findTrapLoss stays quiet when the move was never judged', () => {
  // No analysis arrived, so there is no mistake recorded and no claim to make.
  const records = centreFirstLoss.records.map((record) => ({
    ...record,
    judged: false,
    mistake: null,
  }));
  assert.equal(findTrapLoss({ ...centreFirstLoss, records }), null);
});

test('findTrapLoss stays quiet for a loss that had no taught trap in it', () => {
  // A real X win with no taught trap in it. history[3] is 'XO.X.....', whose
  // key is '.....O.XX' — the side-first shape with the roles swapped, which
  // must NOT match, since the trapped player is always O.
  const noTrap = {
    history: [
      '.........',
      'X........',
      'XO.......',
      'XO.X.....',
      'XOOX.....',
      'XOOXX....',
      'XOOXXO...',
      'XOOXXOX..',
    ].map(cells),
    records: [
      { ply: 2, judged: true, mistake: null },
      { ply: 4, judged: true, mistake: { bestOutcome: 'draw' } },
      { ply: 6, judged: true, mistake: null },
    ],
    humanMark: 'O',
    winner: 'X',
  };
  assert.equal(findTrapLoss(noTrap), null);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && npm test`
Expected: FAIL — no export named `findTrapLoss`.

- [ ] **Step 3: Add `trapKey` to the tutorials**

In `frontend/src/tutorials.js`, add `positionKey` to the `from './game.js'` import (alphabetically, after `playInHistory`).

Replace the `...facts.map((fact) => ({ ... }))` spread at the top of `TUTORIALS` with a block-bodied arrow so `steps` is built once:

```js
  ...facts.map((fact) => {
    const walkthrough = steps(fact.line, NOTES[fact.id]);
    return {
      id: fact.id,
      name: NAMES[fact.id],
      summary: SUMMARIES[fact.id],
      mark: 'X',
      line: fact.line,
      punish: fact.punish,
      losing: fact.losing,
      safe: fact.safe,
      steps: walkthrough,
      // The position with the trap set, keyed by shape so a game that met it
      // rotated still matches. The last step is that position by construction.
      trapKey: positionKey(walkthrough.at(-1).board),
      practice: PRACTICE[fact.id],
      rules: null,
    };
  }),
```

In the `going-second` object, add `trapKey: null,` immediately after `steps: [],`.

- [ ] **Step 4: Implement `findTrapLoss`**

Add to the end of `frontend/src/tutorials.js`:

```js
/**
 * The tutorial explaining a loss, when the player walked into a taught trap.
 *
 * Three things must hold: the human lost, a move of theirs was flagged as an
 * outcome-changing mistake, and the position they played it in was one of the
 * taught traps under any rotation or reflection.
 *
 * Only one ply can ever match — a trap position holds exactly three marks — but
 * the walk is written generally rather than hardcoding ply 4, so a longer
 * tutorial line would not break it silently.
 *
 * @param {object} game - The finished game.
 * @param {Array<Array<'X' | 'O' | null>>} game.history - Every position, from
 *   the empty board.
 * @param {Array<{ply: number, mistake: object|null}>} game.records - One entry
 *   per human move.
 * @param {'X' | 'O' | null} game.humanMark - The human's mark, null in hotseat.
 * @param {'X' | 'O' | null} game.winner - Who won, or null if nobody did.
 * @returns {{tutorial: object, ply: number, rotated: boolean} | null} The
 *   tutorial to offer, which ply lost it, and whether the board was turned
 *   relative to the way the tutorial teaches it.
 */
export function findTrapLoss({ history, records, humanMark, winner }) {
  if (!humanMark || !winner || winner === humanMark) {
    return null;
  }
  for (const record of records) {
    const before = record.mistake ? history[record.ply - 1] : null;
    if (!before || nextPlayer(before) !== humanMark) {
      continue;
    }
    const key = positionKey(before);
    const tutorial = TUTORIALS.find((entry) => entry.trapKey === key);
    if (tutorial) {
      const taught = tutorial.steps.at(-1).board;
      return {
        tutorial,
        ply: record.ply,
        rotated: !before.every((cell, index) => cell === taught[index]),
      };
    }
  }
  return null;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd frontend && npm test`
Expected: PASS, 63 tests.

- [ ] **Step 6: Prove the tests have teeth**

Temporarily change the guard to `if (!humanMark || !winner) {` (dropping the "human lost" half). Run `npm test`; the "stays quiet unless the human lost" test must FAIL. Restore it and confirm PASS.

- [ ] **Step 7: Gates**

Run: `cd frontend && npx prettier --write src/tutorials.js src/game.test.js && npm run lint && npm test && npm run build`
Expected: all clean, 63 tests pass.

- [ ] **Step 8: Report, do not commit**

Files: `frontend/src/tutorials.js`, `frontend/src/game.test.js`. Suggested subject line `Detect the taught trap that lost a game`.

---

### Task 3: Pin the trap keys in the backend suite

**Files:**
- Modify: `backend/tests/test_tutorials.py` (append)

**Interfaces:**
- Consumes: existing `load_tutorials`, `trap_position`, `_canonical` in that file.
- Produces: nothing the app imports. This is the assertion that keeps the two languages' symmetry code honest.

- [ ] **Step 1: Write the test**

Append to `backend/tests/test_tutorials.py`:

```python
def test_the_trap_positions_have_three_distinct_keys() -> None:
    """The frontend tells traps apart by shape, so the shapes must differ.

    `positionKey` in frontend/src/game.js computes these same three strings and
    asserts them in game.test.js. A change to either side's symmetry code, or to
    a tutorial's line, breaks one of the two suites rather than silently
    matching the wrong tutorial to a player's loss.
    """
    keys = {
        tutorial["id"]: _canonical(trap_position(tutorial["line"]))
        for tutorial in load_tutorials()
    }
    assert keys == {
        "centre-first": "..O.X.X..",
        "corner-first": "..X.O.X..",
        "side-first": ".....X.XO",
    }
```

- [ ] **Step 2: Run the test**

Run: `cd backend && uv run pytest -q -k trap_positions_have_three`
Expected: PASS. (It passes immediately — it pins behaviour that already holds, which is the point.)

- [ ] **Step 3: Prove it has teeth**

Temporarily change `"centre-first"`'s expected value to `"..X.X.O.."`. Run the test and confirm FAIL. Restore it and confirm PASS.

- [ ] **Step 4: Gates**

Run: `cd backend && uv run pytest -q && uv run ruff check . && uv run ruff format --check .`
Expected: 86 tests pass, all checks clean.

- [ ] **Step 5: Report, do not commit**

File: `backend/tests/test_tutorials.py`. Suggested subject line `Pin the trap keys the frontend matches on`.

---

### Task 4: Offer the tutorial in the review

**Files:**
- Modify: `frontend/src/TeachingPanel.jsx`
- Modify: `frontend/src/Game.jsx`
- Modify: `frontend/src/App.jsx`

**Interfaces:**
- Consumes: `findTrapLoss` from Task 2.
- Produces: no new exports. `TeachingPanel` gains props `trapOffer` and `onLearnTrap`; `Game` gains props `trapShown`, `onTrapShown`, `onLearnTrap`.

There are no component tests in this repo (`npm test` is `node --test` over pure modules, and adding jsdom would mean a new dependency for one task). This task is verified in the browser, as Phases 2b, 3 and 4 were.

- [ ] **Step 1: Render the block in `TeachingPanel`**

Add `trapOffer` and `onLearnTrap` to the destructured props, after `records` and `onGoTo`.

Inside the `analysis.status !== 'in_progress'` branch, immediately after the `{unjudged > 0 && (...)}` paragraph and before the closing `</div>`:

```jsx
        {trapOffer && (
          <div className="border-top mt-3 pt-3">
            <p className="mb-2">
              That was the <strong>{trapOffer.tutorial.name}</strong> trap
              {trapOffer.rotated ? ', turned round' : ''}.
            </p>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => onLearnTrap(trapOffer.tutorial.id)}
            >
              See how it works
            </button>
          </div>
        )}
```

- [ ] **Step 2: Detect and gate in `Game`**

Add `findTrapLoss` to the imports:

```js
import { findTrapLoss } from './tutorials.js';
```

Add the three new props to the signature: `function Game({ settings, onChange, onQuit, muted, trapShown, onTrapShown, onLearnTrap }) {`.

After the `const teachingOn = ...` line, add:

```js
  // Only in a finished game against the computer: in hotseat `records` holds
  // both players' moves and there is no single "you" to address.
  const trapLoss =
    over && vsComputer
      ? findTrapLoss({
          history,
          records,
          humanMark,
          winner: winner?.player ?? null,
        })
      : null;
```

Add the per-game flag beside the other `useState` calls at the top of the component:

```js
  // Whether THIS game is showing the trap offer. Separate from App's
  // session-wide flag: without it the block would vanish the instant it
  // recorded itself, because the flag that reveals it would then suppress it.
  const [offerTrap, setOfferTrap] = useState(false);
```

Add the effect after the computer-move effect:

```js
  const trapAvailable = trapLoss !== null;
  useEffect(() => {
    if (!trapAvailable || trapShown || offerTrap) {
      return;
    }
    setOfferTrap(true);
    onTrapShown();
    // `onTrapShown` is recreated every render, so listing it would re-run this
    // on every render rather than only when a trap first becomes available.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [trapAvailable, trapShown, offerTrap]);
```

In `startNewGame`, add `setOfferTrap(false);` alongside the other resets.

Pass both down to `TeachingPanel`, after `onGoTo={goTo}`:

```jsx
                  trapOffer={offerTrap ? trapLoss : null}
                  onLearnTrap={onLearnTrap}
```

- [ ] **Step 3: Hold the session flag in `App`**

Add beside the other `useState` calls:

```js
  // Session-wide, deliberately not stored: localStorage is per-browser rather
  // than per-person, so a remembered "already seen" would silence the offer for
  // someone who has never seen it. Reloading is the only way to get another.
  const [trapShown, setTrapShown] = useState(false);
```

Add three props to the `<Game>` element:

```jsx
          trapShown={trapShown}
          onTrapShown={() => setTrapShown(true)}
          onLearnTrap={(id) => {
            setTutorialId(id);
            setScreen('tutorial');
          }}
```

- [ ] **Step 4: Gates**

Run: `cd frontend && npx prettier --write src/TeachingPanel.jsx src/Game.jsx src/App.jsx && npm run lint && npm test && npm run build`
Expected: all clean, 63 tests pass.

- [ ] **Step 5: Verify in the browser**

Start both servers (kill them afterwards, including the reparented node child — `kill` on the `npm` wrapper alone leaves the port held):

```bash
cd backend && uv run flask --app app run --port 5000 &
cd frontend && npm run dev &
```

Then, at `http://localhost:5173`:

1. Play → **Computer — perfect**, and set **Computer plays: X** so the computer opens and you are the victim. Teaching on **Best move**.
2. Let the computer open. Play the line that reaches the Centre first trap, then take a **side** — the losing reply. Play on to the loss.
3. Confirm: the review names the trap, says "turned round" only if the board really is rotated relative to the tutorial, and the button opens the Centre first tutorial at its watch phase.
4. "Back to tutorials" returns to the Learn list.
5. Play a **second** qualifying loss in the same tab. Confirm no block appears.
6. Reload the page, lose the same way, and confirm the block is back.
7. Play a hotseat game to a loss and confirm no block ever appears.
8. Check the console for errors.

- [ ] **Step 6: Report, do not commit**

Files: `frontend/src/TeachingPanel.jsx`, `frontend/src/Game.jsx`, `frontend/src/App.jsx`. Suggested subject line `Offer the tutorial for the trap that just beat you`. Report the browser results, including which steps you actually ran.

---

### Task 5: Readable tutorial prose

**Files:**
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/TutorialWatch.jsx`
- Modify: `frontend/src/Tutorial.jsx`
- Modify: `frontend/src/LearnList.jsx`

Changes only how the words are set. **Do not change a single word of tutorial copy.**

- [ ] **Step 1: Add the prose class**

Append to `frontend/src/index.css`:

```css
/* The tutorial commentary is the lesson, not a caption, and it is set like one.
   Measured in the browser: inside `.message-slot`'s 40rem the longest note
   (386 characters) ran 5 lines at ~77 characters each. Prose is comfortable
   between 45 and 75. One `ch` measures 10.8px here, so 60ch would be 648px and
   never constrain a 640px slot; 55ch is 594px and actually bites. Bootstrap has
   no measure utility, which is why this is hand-written. */
.tutorial-note {
  max-width: 55ch;
  margin-inline: auto;
  font-size: 1.0625rem;
  line-height: 1.7;
}
```

- [ ] **Step 2: Apply it, and stop shrinking text that carries meaning**

In `TutorialWatch.jsx`:
- The commentary paragraph `<p aria-live="polite">{current.note}</p>` becomes `<p className="tutorial-note" aria-live="polite">{current.note}</p>`.
- The red/green legend `className="text-body-secondary small mb-0"` becomes `className="text-body-secondary mb-0"` — it is the key to the colour coding, not decoration.
- **Leave the step counter's `small` alone** (`className="text-body-secondary small"`). It genuinely is a caption.

In `Tutorial.jsx`:
- The summary `className="text-body-secondary small mb-4"` becomes `className="text-body-secondary mb-4"`.
- The "Want to see it for yourself?" paragraph `className="text-body-secondary mt-3"` becomes `className="text-body-secondary mt-3 tutorial-note"`.
- The unlock note `className="text-body-secondary small mt-2 mb-0"` becomes `className="text-body-secondary mt-2 mb-0"`.

In `LearnList.jsx`:
- `<small className="text-body-secondary">{tutorial.summary}</small>` becomes `<span className="text-body-secondary">{tutorial.summary}</span>`.

- [ ] **Step 2b: Stop the walkthrough's controls moving**

Added during execution, not in the original plan. Setting the notes larger made
an existing defect visible: Centre first's four notes run 84, 109, 138 and 386
characters, so a self-sizing block pushes Back, Forward and "Now you try" down
**85px** on the last step. Widening alone cannot fix it — fitting 386 characters
into the old 128px floor needs ~129 characters a line, worse than the 77 we
started from.

In `TutorialWatch.jsx`, render every note into one grid cell with only the
current one visible, and reserve the legend the same way instead of showing it
only on the last step. Add `.note-stack { display: grid }` with
`.note-stack > p { grid-area: 1 / 1 }`, and a `.message-slot-wide`
(`max-width: 44rem`) for the walkthrough. Set `.tutorial-note` to `64ch` — the
tightest width that still wraps the longest note to 5 lines rather than 6.

Use `visibility: hidden`, not `display: none`: it is what reserves the height,
and it also keeps the hidden notes out of the accessibility tree so the live
region announces one note rather than four.

- [ ] **Step 3: Gates**

Run: `cd frontend && npx prettier --write src/index.css src/TutorialWatch.jsx src/Tutorial.jsx src/LearnList.jsx && npm run lint && npm test && npm run build`
Expected: all clean, 63 tests pass.

- [ ] **Step 4: Verify by eye at three widths**

With the dev servers running, open the **Centre first** tutorial and step to the last note (the 386-character one — the longest in the app). At viewport widths **320px**, **768px** and desktop, confirm:

- the note wraps at a comfortable measure rather than the full 40rem;
- the board is not pushed off-screen and the page does not scroll horizontally;
- the note does not overflow the height `.message-slot` reserves so badly that the Forward button jumps down the page;
- both light and dark themes still read.

Then run a Lighthouse accessibility audit in **both themes** and confirm it is still 100. Treat that as the floor, not the goal — it checks contrast and cannot judge line length.

- [ ] **Step 5: Confirm no copy changed**

This task must not touch `frontend/src/tutorials.js` at all — the tutorial copy
lives there, and Task 5 changes only how words are set. Confirm that file is not
among the files you edited. (Do not try to prove this with `git diff`: Task 2
edits the same file legitimately, so its diff is not empty and says nothing
about this task.)

- [ ] **Step 6: Report, do not commit**

Files: `frontend/src/index.css`, `frontend/src/TutorialWatch.jsx`, `frontend/src/Tutorial.jsx`, `frontend/src/LearnList.jsx`. Suggested subject line `Set tutorial prose for reading, not for captions`. Report the Lighthouse scores and the three widths checked.

---

### Task 6: New README hero image

**Files:**
- Replace: `docs/screenshot.png`
- Modify: `README.md:16`

- [ ] **Step 1: Capture the image**

With the dev servers running and the app in the **light** theme, at a viewport of about **1000x900**:

1. Landing → **Learn** → **Centre first**.
2. Press **Forward** three times to reach the final watch step. The board shows `O...X...X` with four red squares (1, 3, 5, 7), two green (2, 6), the legend beneath, and the long note explaining the trap.
3. Capture the tutorial region — heading, board, legend and note. Not the whole viewport if that leaves large empty margins; GitHub scales the image to the column, so wasted space costs legibility.
4. Save over `docs/screenshot.png`.

- [ ] **Step 2: Rewrite the alt text**

`README.md` line 16 currently reads:

```markdown
![A warning about the move just played, the losing line, and a review naming the mistake](docs/screenshot.png)
```

Replace with:

```markdown
![The Centre first tutorial with its trap set: four red squares where the opponent's reply loses, two green where it survives, and the note explaining why a player looking for a block sees nothing to do](docs/screenshot.png)
```

- [ ] **Step 3: Check the alt text stands alone**

Read the new alt text with the image hidden. It must describe what is shown, not merely name it — that sentence is the whole image for a screen-reader user.

- [ ] **Step 4: Check it reads at column width**

Confirm the PNG is legible scaled to roughly 800px wide, which is about what GitHub gives it. If the note's text is unreadable at that size, recapture at a narrower viewport so the type is proportionally larger.

- [ ] **Step 5: Stop the dev servers**

```bash
pkill -f 'flask --app app run --port 5000'
```

Then find and kill the Vite process **and its node child** — killing the `npm` wrapper alone leaves the port held by a reparented `node .../vite`. Confirm with `curl -s -o /dev/null -w '%{http_code}' localhost:5173` returning `000`.

- [ ] **Step 6: Report, do not commit**

Files: `docs/screenshot.png`, `README.md`. Suggested subject line `Lead the README with the trap, not the review`.

---

## Final verification

After all six tasks, before handing back:

- [ ] `cd frontend && npm test && npm run lint && npx prettier --check src/ && npm run build`
- [ ] `cd backend && uv run pytest && uv run ruff check . && uv run ruff format --check .`
- [ ] `git status` — confirm nothing is staged and no unexpected file changed
- [ ] `git diff -- frontend/src/tutorials.json` is empty (that file is out of scope this phase)
- [ ] No dev servers left running on `:5000` or `:5173`

Expected totals: **63 frontend tests, 86 backend tests.**
