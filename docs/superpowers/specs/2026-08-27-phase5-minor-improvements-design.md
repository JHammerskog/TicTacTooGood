# Phase 5: Minor Changes and Improvements — Design

## Project context

TicTacTooGood teaches a player the patterns that decide tic-tac-toe. It is also
a vehicle for learning React from a Flask/Jinja/raw-JS background.

Phase 0 built the stack. Phase 1 made a playable hotseat game. Phase 2a built
the Python engine and `POST /api/analyse`. Phase 2b built the teaching UI and
the computer opponent. Phase 3 added time — history, replay, critique, review.
Phase 4 added four strategy tutorials.

Phase 5 is not a new capability. It is three improvements to what Phase 4 left:
one connection that was missing, one image that no longer matches the pitch, and
one piece of typography that is harder to read than the writing deserves.

## This is the last phase

Phase 5 closes the phased build. The app is finished after it: the tutorials
teach, the engine explains, the review connects the two, and there is no
capability left that the project set out to have and does not.

What follows is not Phase 6. Later work on TicTacTooGood is maintenance and
minor adjustment to what has been delivered — a wording change, a colour, a
dependency bump, a bug — and it needs no spec, no plan document and no phase
number. A future reader looking for the next phase should stop here: the
question is not "what is the next phase" but "what small thing needs
adjusting".

If something genuinely new is ever wanted — accounts and stored progress being
the obvious candidate, since `CLAUDE.md` still parks the database decision —
that is a new project against a finished app, and it should be brainstormed from
scratch rather than treated as a continuation of this sequence.

## Scope

**In Phase 5:**

1. **The trap review link** — when a player loses to a trap the app teaches, the
   review says so and offers the lesson.
2. **A new README hero image** — the trap step, not the end-of-game review.
3. **Readable tutorial prose** — line length, size and contrast for the
   commentary, which is the lesson rather than a caption.

**Not in Phase 5:** any backend behaviour change (one test is added, no endpoint
moves); stored progress or accounts; re-orienting tutorials; rewriting any
tutorial copy. Item 3 changes how the words are set, never the words.

Items 2 and 3 are independent of item 1 and of each other. Nothing here needs to
land in order.

---

# 1. The trap review link

Phases 3 and 4 each solved half a problem and left the halves apart. The review
knows exactly which move lost the game but has never heard of the tutorials. The
tutorials explain exactly why that move loses but only reach a player who has
already decided to go and learn something. The player most likely to want the
lesson — the one who has just been beaten by it — is the one the app currently
says nothing to.

**Done means:** losing to one of the three taught traps ends with a line in the
review naming that trap and a button that opens its tutorial. At most once per
session, and nowhere else.

## The moment this exists for

The trigger is deliberately the narrowest available. All three must hold:

1. The game was **lost** by the human.
2. A move was **flagged as a mistake** — `judgeMove` reports only
   outcome-changing errors, draw to loss or win to draw, so a flagged move is
   one that actually cost something.
3. The board **before that move** is one of the three taught trap positions,
   under any rotation or reflection.

Thrown-away draws do not qualify. Losses unrelated to a taught trap do not
qualify. Neither does a game where the trap appeared but the fallible opponent
blundered it back — the player felt nothing, so there is nothing to catch them
at.

This is rare, and that is the point. The feature's whole value is arriving at
the moment the player has just felt the problem. Arriving at any other moment
makes it a nag.

## Only against the computer

In hotseat `records` holds every move by both sides and there is no single
"you" — the same reason the review had to stop saying "you played it out
correctly". Pointing at "the trap you lost to" would address the wrong person
half the time. Shown only when `settings.computerMark` is set.

## The victim is always O

The trapper opens and ends the line holding two marks; the victim replies once
and holds one. So the trapped player is always the second player, always O.

Two consequences, both of which fall out rather than needing code:

- The block can only appear when the computer opened. A human playing X is the
  potential *trapper*, and these traps cannot beat them in the taught shape.
- A game in which the *computer* was the victim cannot match, because `records`
  holds only human moves — the game screen's click handler is its sole writer,
  and the computer plays through the effect instead.

No special case is written for either. They are recorded so the next reader does
not go looking for the guard that enforces them.

## Detection

Positions are compared by shape. A key is the lexicographically smallest of a
board's eight renderings under the square's symmetries — four rotations, each
also mirrored — so two positions that are rotations or reflections of one
another share a key.

Marks are compared as they are, with no role-mapping. Because the victim is
always O, a real game's trap carries the same marks as the taught one, and the
three trap positions have three distinct keys:

```
centre-first  ..O.X.X..
corner-first  ..X.O.X..
side-first    .....X.XO
```

Distinctness is what makes a match unambiguous, so it is asserted in the backend
suite alongside the other proved facts rather than assumed here.

`game.js` gains `SYMMETRIES` — the eight permutations, built once — and
`positionKey(board)`. They sit with `WINNING_LINES`: this is board geometry, and
nothing about it is specific to tutorials.

The same eight symmetries already exist in `backend/tests/test_tutorials.py`,
where they deduplicate positions during the five-trap enumeration. That copy
stays. The two do different jobs — one proves content, one matches a game in
progress — and neither can drift silently, because the backend test pins the
keys the frontend matches on.

## The shape of a match

`tutorials.js` gains `trapKey` on each attacking tutorial, computed once at
module load from the last step's board, and:

```js
findTrapLoss({ history, records, humanMark, winner })
// -> { tutorial, ply, rotated } | null
```

It returns the **first** flagged mistake that matches, walking `records` in
order. In practice there can only ever be one: a trap position holds exactly
three marks, so only ply 3 can match it, and only the ply-4 reply can be the
blunder. The loop is written generally anyway rather than hardcoding ply 4,
so a future tutorial with a longer line does not break it silently.

`rotated` is a plain comparison against the taught orientation, so the copy says
"turned round" only when the board really was turned. The tutorial itself is
always shown in its own fixed orientation — Phase 4's decision stands, and the
review row above still jumps to the player's own board for comparison.

The function is pure and takes plain data, so it unit-tests alongside the rest
in `game.test.js` with no component rendering.

## State: shown at most once

Nothing is stored. `localStorage` is per-browser rather than per-person, so a
stored "already seen" would suppress the pointer for someone who never saw it —
the reasoning that removed Phase 4's completion tracking.

Suppression is in memory, and needs two flags rather than one:

- `App` holds `trapShown`, session-wide. Once true, no later game offers one.
- `Game` holds `offerTrap`, per game. Without it the block would vanish the
  instant it recorded itself, because the flag that shows it would then suppress
  it on the next render.

An effect sets both together the first time a match appears in a finished game.
`New Game` resets only the per-game flag. Reloading clears both, which is the
intended and only way to see a second pointer.

## Placement and copy

At the bottom of the review panel, under the slip list, separated by a rule:

```
Computer won.

Where it went wrong
┌────────────────────────┐
│ Move 4: O middle left  │  <- existing row, jumps to that ply
│ had a draw — loses     │
└────────────────────────┘
────────────────────────
That was the Centre first
trap, turned round.
 [ See how it works ]
```

The review is where the explanation of what went wrong already lives, so the
pointer is read by someone already reading about their mistake, and by nobody
else. Deliberately not in the `message-slot` above the board: that slot carries
errors and critique warnings, and borrowing its prominence would borrow an alarm
it does not deserve.

It is not attached to the slip row itself. Those rows are buttons that jump to a
ply, and a button cannot contain another button.

The block renders whatever the teaching dial says, matching the review it sits
in — Phase 3 already fetches an analysis at game over regardless of the dial.

## Navigation

The button opens that tutorial at its watch phase, through the same route the
Learn list uses: `App` sets `tutorialId` and switches to the `tutorial` screen.
"Back to tutorials" then returns to the Learn list.

The finished game is not preserved. It is over, and the only thing to return to
is a review that has just been read. `<Tutorial>` already carries a `key`, so it
mounts fresh from this route exactly as from the index.

## Testing

Frontend, in `game.test.js`:

- `positionKey` gives one key for all eight symmetries of a position, and
  different keys for genuinely different positions.
- Each tutorial's trap position is recognised under all eight orientations.
- `findTrapLoss` returns the tutorial for a lost game that went through a trap;
  `null` for a draw, for a win, for a hotseat game, for a matching position
  whose move was never judged, and for a loss containing no trap.

No test covers two matching mistakes in one game: only a three-mark board can
match, so only ply 3 can, and constructing a second would mean fabricating a
position no game can reach.

Backend, in `test_tutorials.py`: the three trap positions have three distinct
canonical keys. This is the assumption the whole match rests on, so it belongs
with the other claims the solver proves.

Browser: the block appears after a qualifying loss, the button reaches the right
tutorial, and a second qualifying loss in the same session shows nothing.

---

# 2. The README hero image

`README.md` opens by describing the tutorials, then shows a screenshot of the
end-of-game review — an image chosen when the review was the newest thing in the
app. The picture and the pitch no longer agree.

**The new image:** the final watch step of **Centre first**. Four red squares,
two green, the legend beneath, and the commentary explaining that a player
scanning for a block sees nothing to do. It shows the idea the whole app is
built around in one frame, and it is the only screen where the teaching is
visible without playing anything.

Replaces `docs/screenshot.png` at the same path, so only the alt text changes.
The current alt text describes the review and must be rewritten to describe what
is actually shown — it is the only description a screen-reader user gets.

Captured in the light theme at a width that keeps the board and the note legible
on a phone, since GitHub scales the image down to the column.

## Testing

By eye, and by reading the alt text on its own to check it still says something
useful without the image.

---

# 3. Readable tutorial prose

The commentary is the lesson. It is currently set like a caption.

**What is actually wrong**, measured rather than guessed:

- **Line length.** `.message-slot` is `max-width: 40rem`. Measured in the
  browser, the longest note (386 characters) runs 5 lines at about **77
  characters** each. Prose is comfortable between 45 and 75, so this is over
  but not wildly so — the fix is a nudge, not a rebuild.
- **Size and contrast.** The tutorial summary, the red/green legend, the step
  counter, the unlock note and the Learn list summaries are all `small`, and
  most are also `text-body-secondary`. Small plus low contrast is right for a
  caption and wrong for the sentence explaining the trap.
- **Leading.** Bootstrap's 1.5 is tuned for interface text, not for a paragraph
  someone reads once and has to follow.

**The change**: one CSS class for tutorial prose, constraining measure in `ch`
and loosening leading; and dropping `small` from the lines that carry meaning
rather than decoration. The step counter stays small — it is genuinely a
caption.

**And the walkthrough's controls must stop moving.** Setting the notes larger
made this visible rather than causing it: Centre first's steps run 84, 109, 138
and 386 characters, so the block sizing itself to its content pushed Back,
Forward and "Now you try" down 85px on the last step alone. Every note is
therefore rendered into one grid cell with only the current one visible, so the
block is always as tall as **that tutorial's** longest note. `visibility:
hidden` reserves the space and keeps the hidden notes out of the accessibility
tree, so the live region still announces one note.

Reserving per tutorial rather than globally is what makes this affordable: Side
first's longest note is 167 characters, so it reserves three lines while Centre
first reserves five. A single `min-height` would have charged every tutorial the
worst case.

Measure is then a trade against that reserved height, since each line costs a
line of dead space on the short steps. 64ch is the tightest width that still
wraps the longest note to 5 lines rather than 6.

No new dependency, no type scale, no font change.

## Testing

Lighthouse Accessibility must stay at 100 in both themes. That is the floor
rather than the goal: it checks contrast, but nothing automated judges line
length or leading. So also, by eye — the longest note at 320px, 768px and
desktop, confirming the narrower column has not pushed the board off-screen.
And measured rather than eyeballed: the walkthrough's controls must sit at the
same y across all four steps of every tutorial.

## Out of scope

Rewriting any tutorial copy. A custom font. A type scale. Changing the board's
own sizing, which is `clamp()`-based and already responsive.
