# Phase 2a: Solver Engine and Analysis API — Design

## Project context

TicTacTooGood is a tic-tac-toe app whose real purpose is teaching the player
the simple patterns that matter in the game. It is also a vehicle for learning
React from a Flask/Jinja/raw-JS background.

Phase 0 built the stack; Phase 1 (see
`2026-08-24-phase1-playable-game-design.md`) made it a playable hotseat game
with win detection, a win line, and a New Game button. All game logic lives in
the frontend so far; the backend still serves only `/api/hello`.

Phase 2 is the solver — the part the app exists for. It is split in two:

- **Phase 2a (this spec):** the Python engine and the analysis endpoint. No UI
  changes. Deliverable: a tested endpoint that takes a board and returns, for
  every legal move, what perfect play says about it and what the move is called.
- **Phase 2b:** the teaching UI — a start screen with game modes, a computer
  opponent, move history with undo, and four teaching presentations, all built
  on 2a's endpoint.

The split falls on the API contract. It keeps 2b's React work off the critical
path of minimax debugging, and it reflects the honest order of the work: the
four presentations cannot be designed well until the data they present exists.

## Goal

Given any board, say what every legal move leads to under perfect play, and
name the pattern each move represents.

**Done means:** `POST /api/analyse` with a board returns per-move outcomes,
distances, rule names, and which moves are optimal; malformed or unreachable
boards are rejected with a 400 that says what was wrong; the engine's own
correctness is proven by tests.

## What the app teaches

The vocabulary, in priority order. This is the classic tic-tac-toe strategy,
and it is what "the simple patterns that matter" means concretely:

| Rule | Means |
|---|---|
| `win` | completes three in a row |
| `block` | the opponent had an immediate win at that cell |
| `fork` | after this move the mover has two immediate winning moves |
| `block_fork` | a move that removes an opponent fork threat: the opponent can fork now, and cannot after this move |
| `centre` | index 4 |
| `opposite_corner` | diagonally opposite a corner the opponent holds |
| `empty_corner` | any free corner |
| `empty_side` | any free edge |

These names are **descriptive**: a rule says what a move *is*, while minimax
independently says whether it is *good*. The two can disagree, and that
disagreement is itself teachable — "taking the centre is usually right, but
here it loses."

Because `centre`, the four corners, and the four sides between them cover all
nine cells, every legal move always has a name. `rule` is therefore never null.

### Why `block_fork` is defined by effect, not by cell

The obvious definition — "a cell where the opponent would fork" — is wrong,
and measurably so. When the opponent has several forking cells, taking one of
them does not stop the fork, yet that definition names every one of them
`block_fork`. Measured across all 5,478 reachable positions, 2,820 of 3,708
such namings (76%) were moves that left the opponent's fork fully available.

The name is therefore defined by what the move achieves: the opponent can fork
before it and cannot after it. That also handles the case the cell-based
definition misses, where blocking one square happens to defuse another. Under
this definition no naming is false, and `block_fork` still occurs in 1,664
positions, so nothing was lost but the lies.

This matters more here than it would elsewhere: the app's product is
vocabulary the player learns to trust. A move labelled "block the fork" that
does not block the fork teaches a wrong lesson, which is worse than teaching
nothing.

## Architecture

```
backend/
├── game.py       # board rules: winner, legal moves, player to move, terminal
├── solver.py     # minimax search -> outcome + distance per move
├── rules.py      # names the pattern a move satisfies
├── schemas.py    # Pydantic request/response models
├── app.py        # the route, thin
└── tests/        # pytest
```

`rules.py` is separate from `solver.py` on purpose. "What does perfect play
say" and "what is this move called" are different questions with different
failure modes, and each is worth testing on its own.

`app.py` stays thin: parse, delegate, serialise. No game logic in the route.

### Board representation

The same convention as the frontend, so the frontend can post its `squares`
array unchanged: a list of 9 cells, each `"X"`, `"O"`, or `null`, indexed
left-to-right then top-to-bottom (0 is top-left, 8 is bottom-right).

### Accepted duplication

`game.py` re-implements win detection that `frontend/src/game.js` already has.
This is deliberate, not an oversight.

The alternative is the frontend asking the server "did someone just win?" after
every move, adding a network round-trip before the board can show a result.
That is a worse application.

What is actually duplicated is a list of eight index triples and a short loop,
on each side, each covered by its own tests — and the rules of tic-tac-toe will
not change. Any future change to one must be mirrored in the other; there is no
third place to look.

## The search

Minimax, scored from the perspective of **the player to move**, returning both
an outcome and a distance:

- `outcome`: `win`, `draw`, or `loss`
- `distance`: plies remaining **after** the move is played, until the game
  ends under optimal play from both sides. A move that completes three in a
  row has `distance: 0`; a move after which the opponent is forced to lose on
  the following ply has `distance: 1`.

Distance is not decoration. It is what lets the UI say "this loses in 3", and
what lets Phase 2b's computer opponent prefer a win in one move over a win in
five. Without it every win looks identical and the opponent appears to
dawdle.

Memoisation uses `functools.lru_cache` over a tuple board. Only 5,478 positions
are reachable in tic-tac-toe, so after the first call the whole game tree is
effectively free. Standard library, no dependency, no hand-rolled cache. The
cache lives for the life of the worker process.

A move is marked `best` when its outcome and distance are optimal among the
legal moves — so several moves can be `best` at once, which is correct: from an
empty board every move draws, and none is better than another.

## The naming layer

`rules.py` exposes one function that takes a board and a candidate move and
returns the highest-priority rule that applies. Each of the eight rules is a
small predicate over the board, testable in isolation.

The priority order in the table above is the order they are checked; the first
match wins.

## API

### Request

```python
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
    board: Annotated[list[Cell], Field(min_length=9, max_length=9)]
```

Validated server-side beyond shape — the frontend is not trusted, even though
both sides are ours:

- **exactly 9 cells**
- **reachable move counts** — X moves first, so `count(X)` must equal
  `count(O)` or `count(O) + 1`
- **not two winners** — a board where both players hold a complete line cannot
  be reached

A board that has already been won is **valid input**, not an error: a review
walkthrough legitimately asks about the final position.

Rejections return **400** with a message naming what was wrong. "Board has 8
cells, expected 9" is a useful error; "invalid board" is not.

### Response

```python
class MoveAnalysis(BaseModel):
    index: int
    outcome: Literal["win", "draw", "loss"]   # for the player to move
    distance: int                             # plies until the game ends
    rule: RuleName
    best: bool

class AnalyseResponse(BaseModel):
    status: Literal["in_progress", "won", "drawn"]
    player: Literal["X", "O"] | None          # None when the game is over
    winner: Literal["X", "O"] | None
    winning_line: list[int] | None
    moves: list[MoveAnalysis]                 # legal moves only
```

A terminal board returns `moves: []` with `status` and `winner` set, so the
same endpoint serves the final position of a review with no special case at
the call site.

### How one call serves all four of Phase 2b's teaching modes

One `POST /api/analyse` per position, not one per interaction:

- **Hint before a move:** show a cell where `best` is true, and its `rule`.
- **Critique after a move:** compare the played cell's `outcome` against the
  best available outcome; when it is worse, name the `rule` that was missed.
- **Post-game review:** the same call per position, replayed over history.
- **Live annotation:** render each move's `rule` and `outcome` onto the board.

## Testing

pytest, added with `uv add --dev pytest`.

Two tests carry most of the weight, because both assert externally known
truths rather than the implementation's own opinion:

1. **Engine self-play from an empty board must draw.** Tic-tac-toe is a solved
   draw under perfect play. A wrong perspective, a sign error, or mishandled
   distance all break this.
2. **Every opening move on an empty board evaluates to `draw`.** No first move
   wins or loses against perfect defence.

Beyond those: fork detection on a known forking position; each rule predicate
in isolation; and API tests covering the 400 cases (8 cells, 10 cells,
impossible move counts, two winners) and the terminal-board response.

The positional rules — `centre`, `empty_corner`, `empty_side`,
`opposite_corner` — are tested too. Those are definitions of board geometry,
not judgement calls, and they are stable under any future tuning.

Deliberately **not** tested: the name assigned to a cell where several rules
could each plausibly apply, in a position chosen to be ambiguous. That asserts
the priority order's opinion rather than any rule's behaviour, and would break
the moment the order is tuned — which is a change we should be free to make.

## Notes carried into Phase 2b

- **Move history is a prerequisite, not a feature.** Post-game review cannot
  exist without the full history, and once the frontend holds
  `history: squares[]` instead of a single `squares`, "go back a move" is
  `history.slice(0, -1)`. Both are the same underlying change.
- **`lastMove` becomes derivable** once history exists — compare the last two
  boards — so Phase 1's second `useState` can go away again.
- **A `rank: int` field may be needed for difficulty levels.** `best` is a
  boolean, so an easier opponent that picks a deliberately worse-ranked move
  forces the frontend to re-derive the ordering itself — including the subtle
  half, *win sooner but lose later*. That would be a third encoding of the
  total order, in the language least likely to get the loss-inversion right.
  A server-side `rank` (0 = best) removes it. Purely additive; build it when
  2b actually implements difficulty, not before.
- **The response does not echo the submitted board.** When clicks outrun
  fetches there is no cheap way to discard a stale response. `AbortController`
  solves it client-side; echoing `board` would also solve it and is additive.
  Decide in 2b.
- **`/api/hello` can finally be deleted** in 2b, when the frontend has a real
  endpoint to call. It stays in 2a, which does not touch the frontend.

## Ideas parked for later

- **A heuristic opponent** that plays `rules.py`'s priority list instead of
  minimax. It is beatable, plays like a person rather than a machine, and
  costs almost nothing once the rule layer exists — a better difficulty
  setting than making a perfect engine blunder at random. Phase 2b.
- **Teaching the rule list as a curriculum** — drills that present a position,
  ask the player to spot the fork or the only block, and track which patterns
  they reliably miss. This is a different product from "play a game with
  help": it needs its own progression design and probably the persistence
  that Phase 3 was already expected to bring. Phase 3 candidate, raised by
  the user on 2026-08-24.

## Out of scope for Phase 2a

No UI changes of any kind. No start screen, no game modes, no computer
opponent, no move history, no undo, no teaching presentations — all Phase 2b.
No database. No difficulty levels (they are a 2b presentation choice over the
same engine output: an easier opponent picks a deliberately worse-ranked move).
