# Phase 2b: Teaching UI and Computer Opponent — Design

## Project context

TicTacTooGood is a tic-tac-toe app whose real purpose is teaching the player
the simple patterns that matter in the game. It is also a vehicle for learning
React from a Flask/Jinja/raw-JS background.

Phase 0 built the stack. Phase 1 made a playable hotseat game with win
detection, a win line and a New Game button, all client-side. Phase 2a built
the Python engine and `POST /api/analyse`, which returns for every legal move
its outcome under perfect play, its distance, its rule name, and whether it is
optimal — with no UI changes at all.

Phase 2b is the first phase where the frontend talks to the backend. It turns
the engine into something a player can see and play against.

Phase 2b was originally scoped to include move history, navigation and the
critique presentation. That work is now **Phase 3**; see "Decisions carried
into Phase 3" below, which records the design decisions already made for it so
they are not re-litigated.

## Goal

Let the player choose an opponent and a level of help, then play a game in
which the engine's verdict on every move is visible.

**Done means:** a start screen chooses opponent and teaching level; a fallible
computer opponent plays the rules described below; the board and a side panel
show what perfect play says about each legal move; the player can choose to
move second; and the game remains playable when the backend is unreachable.

## Scope

**In Phase 2b:**

- Start screen: opponent choice and teaching level.
- Computer opponent, two difficulties, chosen server-side.
- Two teaching presentations: best-move hints, and full annotation.
- Who-goes-first toggle.
- The first frontend/backend round-trip, with loading and error handling.

**Explicitly Phase 3:** move history, back/forward navigation, the history
scrubber, replay animation, the pencil sound, the critique presentation, the
take-back, and post-game review.

## The opponent

A new backend module, `opponent.py`, sitting above `solver.py` and `rules.py`
and using both:

```python
Difficulty = Literal["perfect", "fallible"]

def choose(board: Board, difficulty: Difficulty, rng: random.Random) -> int | None:
```

Returns `None` for a terminal board.

**Perfect** picks uniformly at random among the moves where `best` is true.
Still perfect play — every such move is optimal — but it does not play an
identical game every time.

**Fallible** models a competent human rather than a weakened engine. Checked in
order, first match wins:

| Step | Condition | Plays |
|---|---|---|
| 1 | a move named `win` exists | that move |
| 2 | a move named `block` exists | that move |
| 3 | otherwise | uniform random among all legal moves |

The intent: it never misses a win or a losing block, but outside those forced
moves it plays a random non-optimal move, so it concedes the centre, walks
into forks, and is reliably beatable by a player who has learned the
patterns.

Two consequences worth stating, because both are correct rather than bugs:

- When the player has already forked there are **two** moves named `block`.
  Step 2 blocks one of them, and the game is lost anyway — but that loss was
  already certain, so blocking either one is tied-optimal, not an error.
- Step 3 draws from **all** legal moves, optimal ones included. That is what
  makes it read as a person rather than a machine; see below.

**Why step 3 guesses uniformly rather than picking a deliberately worse move.**
Two weaker designs were tried and rejected.

A *second-best* policy plays the same near-optimal line every time and needs the
total move ordering, which would mean adding the `rank` field parked in the 2a
spec.

*Random among the non-optimal moves* was actually built, and shipped until play
testing exposed it. It sounds more fallible, but it is not weaker in a human
way — it is anti-optimal. Whenever the optimal replies form a natural group it
takes the complement every single time. Against a centre opening, where the
four corners are the only drawing replies, it answered with a side in **100%**
of games, so the same losing shape appeared over and over.

Measured across simulated games, uniform guessing versus excluding the optimal
moves:

| | random non-best | uniform random |
|---|---|---|
| Replies to a centre opening with a corner | 0.0% | 45.8% |
| Plays the optimal move in a quiet position where a worse one exists | 0.0% | 37.8% |
| Loses to perfect play | 73.3% | 46.0% |

Uniform guessing needs only `rule` — `best` is not consulted at all in step 3 —
and it stumbles onto the right move often enough to feel like an opponent
rather than a puzzle with one answer.

`rng` is a parameter so tests are deterministic.

**Why this lives on the backend.** The policy is a pure function of the
analysis and could have lived in `game.js`. It is in Python because an
exhaustive harness over all 5,478 reachable positions can then prove the
invariants below — cheap to build there and awkward to rebuild in JavaScript — and because Phase 3's parked heuristic opponent would
need `rules.py` anyway. The project's stated principle is that thinking logic
belongs server-side, with win detection the one accepted duplication.

## API change

Two optional fields. Nothing is removed or renamed, so every existing test and
caller is unaffected.

```python
class AnalyseRequest(BaseModel):
    board: Annotated[list[CellValue], Field(min_length=9, max_length=9)]
    opponent: Literal["perfect", "fallible"] | None = None   # new


class AnalyseResponse(BaseModel):
    status: Literal["in_progress", "won", "drawn"]
    player: Literal["X", "O"] | None
    winner: Literal["X", "O"] | None
    winning_line: list[int] | None
    moves: list[MoveAnalysis]
    suggested: int | None = None                             # new
```

`suggested` is the move `opponent.choose` returns for the player to move. It is
`null` when `opponent` is absent or the game is over.

**Why fold this into `analyse` instead of adding `/api/move`.** There is
already exactly one `/api/analyse` per ply, including at the computer's
position. Adding an optional request field costs no new route and no extra
round-trip; a separate endpoint would add both. The price is that `analyse`
now answers two related questions — "what is true about this position" and
"what would this opponent do" — which is a mild muddle accepted deliberately.

The frontend sends `opponent` **only** on the computer's turn.

## Frontend architecture

```
frontend/src/
├── App.jsx              screen routing + settings
├── StartScreen.jsx      opponent and teaching level
├── Game.jsx             board state, the computer's turn, the controls
├── Board.jsx            extended: annotation tints, star, hover link
├── TeachingPanel.jsx    the words
├── useAnalysis.js       fetch hook
└── game.js              pure rules (extended)
```

### `useAnalysis` — the React concept this phase introduces

```js
const { data, loading, error, retry } = useAnalysis(board, opponent, enabled);
```

`opponent` is passed only when it is the computer's turn, and is `null`
otherwise, so `suggested` comes back null on the human's turn and cannot be
acted on by accident. `enabled` is
`teaching !== 'off' || settings.opponent !== 'hotseat'` — the analysis is
needed either to teach or to move.

A **custom hook** is a function whose name begins with `use` and which calls
other hooks. It exists so "fetch this, track loading and errors, cancel the
stale request" lives in one place instead of being pasted into every component
that needs it.

Compared to Flask: there, the server had the data before it rendered the
template, so there was no such state. Here the component renders first with
nothing, an effect fires, and the component re-renders with the result — so
"loading" and "failed" are states the UI must actually draw.

The hook's cleanup function aborts the in-flight request with `AbortController`
when the board changes. That is what prevents a slow response for move 3
landing after move 4 has been played — the stale-response problem parked in the
2a spec. `AbortController` is a platform API; nothing is added to
`package.json`.

The hook does not fetch at all when teaching is off and the opponent is
hotseat, so that combination performs zero network requests and behaves exactly
as Phase 1 did.

### State

`App` owns `settings`:

```js
{ opponent: 'hotseat' | 'fallible' | 'perfect',
  teaching: 'off' | 'hints' | 'full',
  computerFirst: boolean }
```

Both screens receive it; `Game` receives the setter too, because the teaching
dial and the who-goes-first toggle are adjustable mid-game.

`Game` owns `squares`, `lastMove`, `humanMark` and `hoveredIndex`.

## Screens

### Start screen

```
        TicTacTooGood
  Learn the patterns that decide the game.

  Who are you playing?
    [ Hotseat ]  [ Computer — fallible ]  [ Computer — perfect ]

  Teaching mode:
    ( ) Off   (•) Best move   ( ) Every move
    Stars the strongest move and names the pattern behind it.

              [ Start game ]
```

Fallible is described as "takes a win, never misses a block — after that it
guesses"; perfect as "cannot be beaten. A draw is the win." The fallible wording
deliberately avoids claiming it only misses forks: outside the two forced cases
it picks uniformly at random, so it is much weaker than a forkless expert.

### Game screen

A three-column row whose shape never changes: `col-lg-3` reserved, `col-lg-6`
board, `col-lg-3` teaching panel. The side columns are equal width, so the
board sits dead centre whether or not the panel has anything in it, and Phase
3's move history drops into the left column without moving the board. On narrow
viewports the columns stack.

Under the title, a muted mode line names the current opponent and teaching
setting — "vs Computer — fallible · Showing the best move" — because otherwise
nothing on the game screen says which mode you chose.

The teaching column **always** renders its bordered card, holding muted
placeholder text when teaching is off. Letting the card appear and disappear
made content pop out of blank page and shifted the board sideways; reserving
the frame fixes both.

The teaching dial sits in one fixed slot above the row, rendered exactly once
whatever it is set to — if it moved between containers when toggled, React
would unmount and remount it and the button the user just pressed would lose
keyboard focus.

## The teaching presentation

The dial is labelled **Teaching mode** and has three positions — Off, Best move,
Every move — not two independent checkboxes: full annotation strictly contains
the best-move hint, so two checkboxes would imply four states where there are
three.

On the start screen the dial also renders a line describing the selected
setting, because there is no board on screen yet to make it self-evident.
In-game that line is dropped: the board is right there, and the dial is the
only place the setting is stated — the mode line under the title names the
opponent only, since repeating the teaching setting directly above its own
control was noise.

### When nothing is worth pointing at

If **every** legal move is optimal, no move is singled out: no stars on the
board, and the panel replaces its "Best moves" list with one sentence naming
the shared verdict — "Every move here draws." Calling nine tied moves "best"
teaches nothing, and it was the first thing a player noticed as noise.

The sentence that follows depends on the verdict, because the three cases are
different situations and one wording cannot serve them. Telling a player whose
position is lost to "play whichever you like" reads as the app not understanding
its own analysis. All three are reachable — across the 5,478 positions there are
241 all-tied draws, 248 all-tied wins and 516 all-tied losses — so none of this
copy is defensive:

| Shared verdict | Heading | Then |
|---|---|---|
| draw | Nothing to choose | "Play whichever you like — the position decides nothing yet." |
| win | You cannot miss | "Every square finishes it. Take your pick and enjoy it." |
| loss | Nothing left to do | "Nothing to work out and nothing to save — just choose a square to lose on. They are all equally bad, so pick a pretty one." |

The wording lives in `TIED_MESSAGE` in `game.js` beside the other copy, so it is
covered by the existing `node --test` run rather than only by eye.

This is a property of the position, not of the move number. It is true on the
empty board, and equally true after, say, centre-then-corner, where all seven
remaining moves draw. `allMovesTied` in `game.js` decides it, and because
`best` means optimal on outcome *and* distance, every move in such a position
shares one verdict — so the first move's wording speaks for all of them.

"Best move" mode annotates nothing at all in a tied position; "Every move"
still tints, because showing the whole position is what that mode is for.

| Position | Board | Panel |
|---|---|---|
| `off` | unchanged from Phase 1 | placeholder card; no fetch |
| `hints` | star on the optimal cell(s) | the best rows only |
| `full` | every empty cell tinted by outcome, plus the star | every legal move |

Tints reuse the Bootstrap subtle tokens already used by Phase 1's last-move
yellow: `--bs-success-bg-subtle` for a win, `--bs-secondary-bg-subtle` for a
draw, `--bs-danger-bg-subtle` for a loss.

Panel rows read as words: `centre — fork — wins in 3`. `distance` counts plies
after the move, so it is rendered as "wins now" at 0 and "wins in N" otherwise;
draws show no number.

**Rows are grouped "Best moves" / "Also legal" using only the `best` boolean,
and keep index order within each group.** They are deliberately not sorted by
quality: sorting would mean re-deriving the win-sooner/lose-later total order
in JavaScript, which is the third encoding of that order the 2a spec warned
against — and the language least likely to get the loss inversion right. If a
ranked list is ever wanted, `rank` comes from the server.

Hovering or focusing a panel row lights its cell, and hovering or focusing a
cell lights its row. One `hoveredIndex` in `Game`, passed to both children —
props down, callbacks up, no new concept.

**Accessibility.** Colour is never the only channel. Each annotated cell's
`aria-label` gains its verdict and rule ("centre, empty, wins in 3, fork"), and
the panel states the same in text, so WCAG 1.4.1 holds without inventing
glyphs. Panel rows are focusable so the hover link is reachable by keyboard.

Teaching renders only when `nextPlayer === humanMark`. In hotseat that is every
turn.

## Who goes first

A toggle in the game view, shown only in computer modes, defaulting to
human-first.

X always moves first, so the toggle assigns marks: human-first means the human
is X; computer-first means the computer is X and the human is O. The status
line states which the player is.

**The lock.** `humanMark` is state, not a value derived from
`settings.computerFirst`. If it were derived, flipping the toggle during your
own turn would make `nextPlayer !== humanMark` true and the computer would
steal a move. Instead the toggle rewrites `humanMark` only while the board is
empty:

```js
function toggleWhoStarts() {
  const next = !settings.computerFirst;
  setSettings({ ...settings, computerFirst: next });
  if (played === 0) setHumanMark(next ? 'O' : 'X');
}
```

So flipping it on an empty board takes effect at once; flipping it mid-game
changes nothing about the current game and applies to the next one. A muted
line under the toggle says "Changes apply to the next game" whenever a move has
been played.

**This is an event handler, not an effect, and that is the teaching point.**
The beginner's instinct is a `useEffect` watching `computerFirst` that syncs
`humanMark`. React's guidance is that effects are for synchronising with things
outside React — the network, timers, the DOM — not for reacting to your own
state changes. Something that happens *because the user clicked* belongs in the
click handler. The effect version also cannot distinguish a click from a
re-render, so "only while the board is empty" becomes fiddly there and is one
`if` here.

**No new machinery is needed for the computer's opening move.** The existing
rule — when it is the computer's turn, fetch with `opponent` and play
`suggested` — already fires, because flipping the toggle on an empty board
makes it the computer's turn. New Game behaves the same way.

## The computer's turn

The human's move updates the board immediately. The analysis is then fetched
with `opponent` set, and `suggested` is played after a short pause (~400ms) so
it reads as a move rather than a flicker. The panel shows "Thinking…" during
it.

`suggested` is played only when it is still the computer's turn on the board
the response describes. Because the hook aborts superseded requests, `data`
always corresponds to the current `board`, so this is a guard against the
game having ended rather than against a race.

## Failure

The board never depends on the network: `calculateWinner` is local, which is
what the accepted duplication in `game.py` bought.

- **Hotseat:** the panel shows "Analysis unavailable" with a Retry. The game
  plays on normally.
- **Computer:** the game cannot continue, so the same message and Retry appear
  and the board is left untouched.

There is deliberately **no client-side fallback move** when the backend fails.
A computer that plays differently when the server hiccups is a bug nobody would
ever successfully diagnose.

Loading states are drawn, not skipped: the panel shows a spinner while a
request is in flight. The board is never blocked — the player can always click.

## Housekeeping folded into this phase

Each of these is small, already agreed, and cheaper to do while touching the
same files:

- **Turn derivation moves from `App.jsx` into `game.js`.** `played`, `isDraw`,
  `isOver` and `nextPlayer` become exported functions, tested under the
  existing `node --test`. This was marked in Phase 1 as the first step of
  Phase 2.
- **`lastMove` stays stored.** It only becomes derivable once history exists,
  which is Phase 3.
- **`/api/hello` is deleted.** The frontend now has a real endpoint to call.
- **A Vite dev proxy** maps `/api` to the backend, so the frontend calls a
  relative URL instead of hardcoding `localhost:5000`. The target comes from an
  environment variable so it can be `http://backend:5000` under Docker Compose
  and `http://localhost:5000` outside it.
- **`flask-cors` is removed.** With the proxy in place the requests are
  same-origin and the dependency is dead weight.

## Testing

**Backend, pytest.** A `reachable_positions()` helper is added to
`backend/tests/conftest.py`, enumerating all 5,478 positions a real game can
produce. Every invariant below is asserted across all of them — this exhaustive
check is the reason the policy is server-side at all:

1. Across every reachable position where an immediate win exists, fallible
   plays it and the game is won.
2. Across every reachable position where the mover has no immediate win and
   the opponent has exactly one, fallible's move leaves the opponent with no
   immediate win.
3. Across every reachable position where a non-optimal move exists and neither
   step 1 nor step 2 applies, fallible plays a move with `best == false` —
   without this, an opponent that never blunders would pass every other test.
4. Perfect only ever returns a move with `best == true`.
5. `choose` returns `None` for a terminal board.

Plus API-level tests: `suggested` is null when `opponent` is absent, null when
the game is over, and a legal index otherwise; and an unknown `opponent` value
is a 400.

**Frontend, `node --test`:** the turn-derivation functions moving into
`game.js`.

**No component test framework.** Vitest plus Testing Library is a real
dependency and a real config for a five-component app. Phase 1's UI was
verified through Chrome DevTools MCP and this phase will be too: cell tints,
the star, the hover/focus link, keyboard reachability of panel rows, the
who-goes-first toggle on an empty board and mid-game, the error path with the
backend stopped, and a Lighthouse pass. This is a judgement call about cost,
not a claim that component tests are worthless; if the component count grows
much beyond this, revisit it.

## Decisions carried into Phase 3

These were settled during this phase's design and should not be re-opened:

- **History is `boards[]` plus a `cursor`.** Playing a move truncates `boards`
  at `cursor + 1`, which disables Forward and resets the visible history in one
  operation. Games are short enough that discarding the future outright is
  fine.
- **Back and Forward buttons are always visible** on the board. The full
  history list is *not* — it is behind a click.
- **`lastMove` becomes derivable** at that point: diff `boards[cursor]` against
  `boards[cursor - 1]`. The yellow tint follows the cursor, so it is correct
  while navigating, and Phase 1's second `useState` can go away.
- **Navigation animates.** Jumping several moves replays the intervening moves
  one at a time on a short delay rather than swapping the board instantly.
  Back/Forward is the same replay with a single step.
- **A pencil-writing sound** plays on every move and on every navigation step.
  Whether it is a bundled audio asset or synthesised with the Web Audio API is
  open; it needs a mute control either way.
- **Critique warns after the move and offers a take-back.** The move lands, a
  banner names what went wrong and what was available, and a "Take it back"
  button undoes it. Critique is an independent switch, not a fourth position on
  the teaching dial, because it acts after a move rather than before.
- **Post-game review** replays the stored history through the same endpoint,
  one call per position.

## Ideas parked for later

- **A heuristic opponent** playing `rules.py`'s priority list top to bottom —
  a third difficulty that plays like a person following a checklist.
- **`rank: int` on `MoveAnalysis`** — needed only if the UI ever wants a fully
  ordered list of moves. Additive; build it when something needs it.
- **Echoing the submitted board in the response** as an alternative to
  `AbortController` for discarding stale responses. Not needed now that the
  hook aborts.
- **Drills as a curriculum** — present a position, ask the player to spot the
  fork or the only block, track which patterns they reliably miss. A different
  product from "play a game with help"; needs its own progression design and
  probably persistence. Raised by the user on 2026-08-24, unnumbered.

## Out of scope for Phase 2b

Everything listed under Phase 3 above. No database. No `rank` field. No
heuristic opponent. No component test framework.
