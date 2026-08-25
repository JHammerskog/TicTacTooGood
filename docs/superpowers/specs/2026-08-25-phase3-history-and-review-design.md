# Phase 3: History, Review and Dark Mode — Design

## Project context

TicTacTooGood teaches a player the patterns that decide tic-tac-toe. It is also
a vehicle for learning React from a Flask/Jinja/raw-JS background.

Phase 0 built the stack. Phase 1 made a playable hotseat game. Phase 2a built
the Python engine and `POST /api/analyse`. Phase 2b built the teaching UI —
start screen, teaching dial, board annotation, side panel — and the computer
opponent with two difficulties.

Phase 3 adds the dimension the app has been missing: **time**. Until now a game
is a single position that moves forward and cannot be revisited, so nothing can
be reviewed, nothing can be taken back, and a mistake scrolls past unexamined.

## Goal

Let the player move through a game rather than only through a position, and
show them where it went wrong.

**Done means:** every position is navigable with Back and Forward and a move
list; a bad move is named as it happens and can be taken back; the finished
game reports its turning points; and the app is dark by default.

## Scope

**In Phase 3:** move history with a cursor; Back/Forward; the move list; replay
animation; the pencil sound; critique with take-back; post-game review; dark
mode; and four pieces of carried debt (below).

**Phase 4:** authored strategy tutorials. A tutorial is history playback with
commentary, so it is mostly a content and presentation problem once this
phase's navigation exists.

## The state model

Everything else in this phase rests on one change:

```js
const [history, setHistory] = useState([EMPTY_BOARD]);  // every position so far
const [cursor, setCursor] = useState(0);                // which one is on screen
const squares = history[cursor];                        // derived, never stored
```

Playing a move at cursor `c` produces `history.slice(0, c + 1)` plus the new
board, with `cursor = c + 1`. That one expression truncates the future, which
disables Forward and resets the visible list together — they are not three
behaviours but one.

**`lastMove` stops being state.** It is `history[cursor]` diffed against
`history[cursor - 1]`, so the yellow tint follows the cursor while navigating
and Phase 1's second `useState` is deleted. Phase 2a predicted this.

Branching is deliberately not kept: playing from a past position discards the
future rather than forking. Games are short enough that replaying is cheap, and
a tree would need a UI nobody asked for.

### The trap this creates

`isComputerTurn` derives from `squares`. Navigate back to a position where the
computer was to move and the existing effect fires — the computer plays, and
truncates the game being reviewed.

So the opponent moves only when the game is **settled and live**: the cursor is
at the tip of history, no critique is awaiting an answer, and no replay is
animating. Those three are one idea and belong in one derived boolean, not
three conditions scattered across the component. Every one of them is reachable
in ordinary play, so this is not defensive coding.

## Navigation

Back and Forward sit under the board, always visible, each disabled at its end
of the history. The full move list lives in the left column Phase 2b reserved,
behind a **Moves** button, listing every position and jumping to any of them.

**Replay is one mechanism, not two.** Navigation sets a *target* cursor; an
effect steps the cursor one ply toward it every ~180ms. Back and Forward set a
target one step away, and the move list sets one several steps away — the same
code path either way. While a replay is in flight the board is disabled,
reusing the `disabled` prop the computer's turn already drives.

## Sound

`sound.js` synthesises a pencil scratch with the Web Audio API: a noise buffer
through a band-pass filter, fast attack, roughly 120ms decay, with small random
variation per move so repeated moves do not sound mechanical. No audio file
enters the repo, and nothing is downloaded.

It fires on a move and on **every** step of a replay, which is what makes
flicking back through a game feel like flicking through a notebook.

The `AudioContext` is created lazily on first use, because browsers refuse to
start audio without a gesture and every trigger here follows a click. A mute
control sits beside the theme toggle and persists in `localStorage`.

## Critique

An independent switch, not a fourth position on the teaching dial: critique
acts *after* a move, so it is a different axis. `settings.critique: boolean`.

**The bar: a move is flagged when the outcome class worsens** — a drawn
position becomes lost, or a won one becomes drawn. A slower win is not flagged,
nor is a non-optimal move that still draws. Those are not errors, and flagging
them trains the player to ignore the app.

**No extra request is needed.** At the moment of the click, `data` already holds
the analysis of the position being clicked in, so the played move's outcome and
the best available outcome are both in hand.

That makes the fetch rule load-bearing, so it is stated here rather than left
to the implementation: the analysis is requested whenever **anything** needs it
— teaching is on, critique is on, or the computer is to move. In hotseat with
teaching and critique both off there is no network traffic at all, exactly as
in Phase 1, and the consequence is that such a game produces no records and no
review. That is coherent — the player turned everything off — but it must be
deliberate rather than a surprise.

A move can still be played before its analysis arrives, because the board never
waits on the network. Such a move is recorded with no verdict: it is never
flagged, and the review lists it as unjudged rather than as correct. Silently
treating an unanalysed move as fine would be the app claiming knowledge it does
not have. A pure `judgeMove(analysis, index)`
in `game.js` returns nothing, or the played move, the best outcome and the
alternatives that were available.

The banner names both halves from the analysis — "That hands O the game.
Top-right was the block." — and offers **Take it back**, which steps the cursor
back one, or **Play on**, which dismisses it.

Taking a move back does not erase it: the cursor moves, so Forward still
replays the mistake for another look. It is discarded only when a different
move is played from that position, by the same truncation rule as any other
branch.

The computer is held while a banner is open. If it replied first, taking your
move back would leave its answer on the board.

## Review

Every human move appends a record at click time: the ply, the cell, the rule,
the outcome, and the best outcome that was available. Records are truncated
alongside history.

Nothing is re-fetched when the game ends. The review is a read over records the
app already has, which is why it costs one card rather than nine round-trips.

The review renders in the teaching column's card, which Phase 2b made
permanent precisely so content could appear without the layout jumping. It
therefore shows even with the teaching dial off, provided the game produced
records.

On game over that card becomes **Where it went wrong**: one row per flagged
move, each with a control that sets the replay target to that ply so the board
walks back to it with the annotations showing. A clean game says so instead —
"No mistakes. You played it out correctly." Against the perfect opponent that
sentence is exactly what a draw earns, and the app should say so rather than
staying silent.

## Dark mode

`data-bs-theme` on the root element, defaulting to `"dark"`, persisted in
`localStorage`, toggled from a small header row shared by both screens.

The default is dark **regardless of the operating system's preference**, which
is a deliberate departure from the usual `prefers-color-scheme` convention: the
requirement is that the app is dark unless the player chooses otherwise, not
that it follows their system. Once they choose, `localStorage` remembers.

Bootstrap 5.3 themes its own components from that attribute, and the custom CSS
already uses `--bs-*-bg-subtle` tokens chosen in Phase 1 for exactly this — a
choice never exercised, because nothing ever set the attribute. So most of this
is wiring.

The real work is verification, not implementation: the three annotation tints,
the last-move yellow and the red win line must all be checked for contrast in
dark. They will be measured against the rendered colours, not eyeballed.

## Carried debt, fixed in this phase

Each of these lives in code this phase rewrites anyway:

- **No request timeout.** A *hung* backend — as opposed to a failing one —
  leaves a permanent spinner with no Retry, because Retry renders only on an
  error. `useAnalysis` gains a timeout whose abort is distinguishable from the
  cleanup abort, so one surfaces an error and the other stays silent.
- **The stale annotation frame.** One painted frame shows the new board carrying
  the previous position's verdicts. With a cursor the fix is natural: the hook
  reports which board its analysis describes, and the UI ignores analysis that
  does not match the board on screen.
- **`TeachingDial` lives in `TeachingPanel.jsx`,** so the start screen imports a
  dial from a file named Panel while having no panel. It moves to its own file.
- **Two `aria-pressed` button groups** — the opponent chooser and the teaching
  dial — model N independent toggles where the truth is "exactly one of three".
  They become Bootstrap `btn-check` radio groups, which say that natively and
  look identical. This matters more now than when it was deferred, because this
  phase adds three more controls; the new ones (theme, mute, critique) are
  genuine binary toggles and keep switch semantics.
- **`live_positions` in `test_opponent.py`** has a prose docstring with no
  `Returns:` header, against the project's Python style.

## Testing

**Phase 3 is expected to be entirely frontend.** No endpoint changes, no schema
changes; the backend suite should stay at 61 tests and remain untouched. If a
backend change turns out to be necessary, that is a signal the design is wrong
and worth stopping over.

History mechanics go into `game.js` as pure functions, because truncation is
the easiest thing here to get subtly wrong, and because that is where the
project's testable logic already lives:

- `playInHistory(history, cursor, index, mark)` → the new `{ history, cursor }`.
  Asserted for appending at the tip, and for discarding the future when playing
  from the past.
- `lastMoveIndex(previous, current)` → the changed cell, or null.
- `judgeMove(analysis, index)` → across a worsening move, a non-worsening
  non-optimal move, and a missing analysis.

Replay timing, sound, theming and the review card get Chrome DevTools
verification as in Phase 2b, including a Lighthouse pass in **both** themes.

There is still deliberately no component test framework. That decision is
recorded in the Phase 2b spec and nothing here changes the reasoning.

## Notes carried into Phase 4

- **A tutorial is history playback with commentary.** Once `history` plus
  `cursor` plus the replay target exist, a tutorial is a scripted array of
  positions and a string per step. The navigation should be built so a tutorial
  can drive it without a second mechanism.
- **The move records are close to tutorial steps.** A record already pairs a
  position with a verdict; a tutorial step pairs a position with prose.
- **Authoring format is undecided** and is Phase 4's first question: where the
  user's strategies live, whether the engine annotates them alongside the
  authored commentary, and whether they appear as a third choice on the start
  screen or a separate section.

## Out of scope

Tutorials. Persistence beyond `localStorage`. The heuristic third opponent. The
`rank` field. A branching history tree. Any database.
