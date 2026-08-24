# Phase 1: Playable Tic-Tac-Toe — Design

## Project context

TicTacTooGood is a tic-tac-toe app whose real purpose is teaching the player
the simple patterns/rules that matter in the game. It is also a vehicle for
learning React from a Flask/Jinja/raw-JS background.

Phase 0 (see `2026-08-20-phase0-environment-setup-design.md`) is complete: a
Vite/React frontend and a Flask/uv backend run as two containers under
`docker-compose`, with Ruff, Prettier, oxlint and Bootstrap 5 configured. The
frontend fetches `/api/hello` from the backend and displays the result,
proving the stack talks to itself.

This spec covers Phase 1 only. Phase 2 (the solver, which surfaces the tips
and rules that are the app's point) and Phase 3 (undesigned; likely multiple
concurrent games and persistence) get their own specs when reached.

## Goal

A properly styled, responsive, playable game of tic-tac-toe.

**Done means:** two people can play a full game hotseat in the browser, with
a visible turn indicator, a line drawn across the winning row when someone
wins, draw detection, and a New Game button that resets the board.

## Scope decisions

| Decision | Choice | Why |
|---|---|---|
| Where game state and rules live | Entirely in React | Maximises React learning in the phase whose point is learning React. The backend gets real work in Phase 2, when the solver arrives and needs somewhere to live. |
| Opponent | Two humans, hotseat | No AI code at all. A computer opponent belongs in Phase 2, driven by the same rule engine that generates the teaching tips — building a throwaway one now is work done twice. |
| Persistence | None | No database until Phase 3 at the earliest. Refreshing the page starts a new game, which is acceptable for hotseat play. |

## Architecture

```
frontend/src/
├── game.js        # calculateWinner(squares) -> { player, line } | null
├── game.test.js   # node --test, no test framework
├── Board.jsx      # the 3x3 grid of buttons + the win-line SVG overlay
└── App.jsx        # game state, status text, New Game button
```

Four files, and deliberately no `Square` component: a `<button>` rendered
inside `Board`'s map is enough, and extracting it would add a file and an
indirection without making anything clearer.

## State and data flow

`App` holds the board as its primary state:

```js
const [squares, setSquares] = useState(Array(9).fill(null));
```

Everything else is **derived** — recomputed during render rather than stored:

- whose turn it is: the count of non-null cells (even means X, odd means O)
- the winner and the winning line: `calculateWinner(squares)`
- a draw: no winner and no empty cells remaining

This is the phase's central React lesson. In Jinja the view function computes
values and passes them to the template; in React the component body *is* that
view function, re-run on every state change, so the same computation simply
sits at the top of the component. Storing `xIsNext` or `winner` as additional
state would create several values that must be updated in lockstep, and a bug
the first time one update is missed.

`useReducer` is deliberately not used. It earns its place when several state
fields change together under many distinct actions; here there is one array
and two transitions (play a move, reset the board).

One further value *is* stored, in a second `useState`: the index of the most
recently played cell, which the board tints to show where the last move went.
This does not contradict the rule above. That rule forbids storing what can be
computed, and move order cannot be computed — `squares` records which marks
are on the board, never the sequence they arrived in. It is cleared on New
Game alongside the board itself.

`App` passes `squares` and an `onPlay(index)` callback down to `Board`.
`Board` renders the grid and calls the callback on click; it holds no state of
its own. This is *props down, callbacks up* — the child reports the event
upward and the parent decides what happens, which replaces the form POST and
server-side re-render of the Jinja equivalent.

A click on an occupied cell, or any click after the game has ended, is
ignored. Those cells are marked `aria-disabled` rather than `disabled` (see
Accessibility), so they remain clickable at the DOM level and this guard is
the sole enforcement of move legality — not a backstop.

## Win detection

`game.js` exports a pure function over the board array:

```js
calculateWinner(squares) // -> { player: 'X' | 'O', line: [a, b, c] } | null
```

It checks the eight winning triples and returns both the winner and the line
that won, because the UI needs the line to draw across it. Returning `null`
for no winner keeps the caller's check to a single truthiness test.

Keeping this pure and separate from the components is what makes it testable
without rendering anything, and it is the function Phase 2's solver will
build on.

## Win line rendering

An `<svg viewBox="0 0 3 3">` is layered over the grid with CSS, sized to
match it exactly. When there is a winner, it draws a single `<line>` across
the three winning cells.

Cell index maps to coordinates arithmetically:

```js
const x = (index % 3) + 0.5;
const y = Math.floor(index / 3) + 0.5;
```

Because the viewBox is three units square and the grid is three cells square,
these coordinates land on cell centres with no scaling maths. All eight
lines, diagonals included, fall out of the same two expressions with no
special cases, and the line scales with the board for free.

The line does not stop at those centres. Each end is pushed a further quarter
of a cell outwards along the line's own direction, so it reaches 75% of the
way through its end cells rather than dying mid-glyph — which reads as a
strike-through rather than a stub. The direction comes from the sign of the
difference between the two centres, so the same expression handles rows,
columns, and both diagonals.

The SVG is `aria-hidden`, and gets `pointer-events: none` so it never
intercepts clicks meant for the cells beneath it.

## Styling

Bootstrap 5 utilities for the page container, buttons, and status text.
Custom CSS only for what Bootstrap has no utility for:

- the grid itself: `display: grid`, `grid-template-columns: repeat(3, 1fr)`,
  `grid-template-rows: repeat(3, 1fr)`, `aspect-ratio: 1`. Both track
  definitions are required. With rows left implicit they size to their
  content, so a cell grew taller the moment it held a mark and the board
  jumped as the game progressed; `aspect-ratio` does not prevent this,
  because content can push a grid past its aspect-ratio height.
- responsive sizing: `width: min(90vmin, 400px)`, which keeps the board square
  and fits any viewport without a media query
- the win line's stroke width, colour, and `stroke-linecap: round`
- the most-recent-move tint, using Bootstrap's `--bs-warning-bg-subtle` and
  `--bs-warning-border-subtle` custom properties so it stays legible in both
  light and dark themes

Custom CSS goes in the existing `frontend/src/index.css`.

## Accessibility

- Cells are real `<button>` elements, giving keyboard navigation and focus
  rings without any custom code.
- Each cell has an `aria-label` describing its position and contents, and the
  most recently played cell says so, since the tint that marks it on screen
  conveys nothing to a screen reader.
- The status line lives in an `aria-live="polite"` region, so a screen reader
  announces turn changes and the result.
- Occupied cells and all cells after the game ends get `aria-disabled`
  rather than `disabled`, so they stay focusable: keyboard focus is never
  lost mid-game, and screen-reader users can still tab through and review
  the finished board. `handlePlay`'s guard is what actually enforces move
  legality.
- The win line is decorative and `aria-hidden`; the status text already
  states who won.

## Backend

Unchanged in this phase. The `/api/hello` fetch is removed from `App.jsx`,
since the game replaces it, but the endpoint itself stays as a two-line proof
that the compose wiring still works until Phase 2 gives the backend real
work.

## Testing

One test file, `game.test.js`, run with Node's built-in test runner
(`node --test`). The frontend's `package.json` already sets
`"type": "module"`, so ESM imports work directly and no test framework or new
dependency is needed.

It covers `calculateWinner`: each of the eight winning lines, a board with no
winner, and a full board with no winner (draw). That function is the only
real logic in the phase and it is pure, which makes it exactly the thing
worth testing.

No component tests. They would require adding Vitest and Testing Library to
assert behaviour that is visible by loading the page.

## Out of scope for Phase 1

No AI opponent, no teaching tips or hints (that is the entire point of Phase
2), no move history or undo, no database, no score tracking across games, no
backend changes.

## Carried into Phase 2

The turn and draw derivations (`played`, `isDraw`, `isOver`, `nextPlayer`)
currently live at the top of `App.jsx`. They belong in `game.js` and must move
there when Phase 2 starts, before the solver is built on top:

- the solver needs "whose turn is it" and "is the game over" for every position
  it evaluates, not just the one on screen — leaving them in a component means
  either duplicating them or importing from a React module
- in `game.js` they come under the existing `node --test` run for free, with no
  new dependency; inside a component they are untestable without adding Vitest
  and Testing Library

They were left in `App.jsx` for Phase 1 because a single component was their
only consumer and moving them earlier would have been speculative. That stops
being true the moment the solver exists. The same note is marked at the code
site in `App.jsx` with a `ponytail:` comment.
