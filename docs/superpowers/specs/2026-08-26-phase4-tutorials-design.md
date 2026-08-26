# Phase 4: Strategy Tutorials — Design

## Project context

TicTacTooGood teaches a player the patterns that decide tic-tac-toe. It is also
a vehicle for learning React from a Flask/Jinja/raw-JS background.

Phase 0 built the stack. Phase 1 made a playable hotseat game. Phase 2a built
the Python engine and `POST /api/analyse`. Phase 2b built the teaching UI and
the computer opponent. Phase 3 added time — history, replay, critique, review.

Everything so far teaches **reactively**: it waits for the player to move, then
tells them what that move was worth. Nothing in the app teaches a *plan*. A
player can finish a game having been corrected nine times and still not know
what to open with.

Phase 4 adds the missing half: named strategies, authored by the user from
their own play against human opponents, taught before a move is made.

## Goal

Teach four things the player can carry to a real opponent, and let them
practise each one against an opponent that actually falls for it.

**Done means:** a Learn section lists four tutorials; each walks through its
line with commentary, then hands the player the same line to execute against a
scripted opponent; completing one unlocks the same strategy against the
fallible computer, where it works only as often as it really does.

## Scope

**In Phase 4:** the Learn section; four tutorials (three attacking, one
defending); the watch phase; the practice phase with a scripted opponent; the
fallible unlock; completion tracking in `localStorage`; and the `useGameHistory`
extraction carried from Phase 3 (ruling R10).

**Not in Phase 4:** authoring tutorials in the app, a tutorial editor, more
than these four, or any backend change (see below).

## No backend change

The tutorials are content, not engine. Their positions and prose live in the
frontend, and the scripted opponent is a fixed list of replies, not a policy
worth a round trip. `POST /api/analyse` is untouched, and the practice phase
simply omits the `opponent` field it already treats as optional.

The engine's role in this phase is **verification, not runtime**: every claim
below was checked against `solver.py`, and those checks become tests.

## The idea the tutorials share

All three attacking tutorials set the same kind of trap. The player reaches a
position where:

- the opponent has **no block to play** — neither side has two in a row, so the
  one rule every novice knows gives no guidance; and
- a large share of the opponent's replies lose anyway, to a fork one move later.

This is the user's own observation from playing people: novices are trained to
scan for a block, and when there isn't one they relax. The tutorials teach the
player to build exactly those positions.

## Why these three lines and not others

Following the rules in Tutorial 4, there are exactly **five** positions where a
second player has no block available and can still lose. Only **two** have a
categorical answer — every loser is a side, or every loser is a corner. The
other three have mixed losing sets, so they can only be memorised, not learned.

Tutorials 1 and 2 are those two positions. Tutorial 3 is the same clean shape
reached from a side opening, where the opponent has already answered soundly.

A "clean rule" is the selection criterion for any future tutorial: if the
losing squares do not share a description, there is nothing to teach.

## Tutorial 1 — Centre first

**Line:** you take the centre; they answer with a corner (their only non-losing
reply); you take the corner opposite theirs.

```
O . .        they must now avoid every side
. X .        4 of their 6 replies lose
. . X
```

| | |
|---|---|
| Lose | all four sides |
| Safe | the two remaining corners |
| Share | **4 of 6** — the deadliest of the three |

**The punish.** Every losing reply is answered by taking a corner, and each one
wins in 2:

| They take | You take | Named |
|---|---|---|
| top centre | top right | `block` |
| middle left | bottom left | `block` |
| middle right | bottom left | `fork` |
| bottom centre | top right | `fork` |

Two of these are worth dwelling on in the commentary: their side move *creates a
threat*, so you block it — and the block is itself the fork. The move that looks
like defence is the move that wins.

## Tutorial 2 — Corner first

**Line:** you take a corner; they answer with the centre (their only non-losing
reply); you take the corner opposite your first.

```
X . .        they must now avoid every corner
. O .        2 of their 6 replies lose
. . X
```

| | |
|---|---|
| Lose | the two remaining corners |
| Safe | all four sides |
| Share | 2 of 6 |

**The punish.** They take a corner, you take the other one — a block that wins
in 2 both times: top right → bottom left, bottom left → top right.

This is the mirror of Tutorial 1 and should be taught as such. Same shape,
opposite answer: a corner saves them in Tutorial 1 and kills them here. That is
the point of the pair — a novice's habit cannot rescue them, because the habit
is right half the time and fatal the other half.

## Tutorial 3 — Side first

**Line:** you open on a side; they answer with a corner touching it; you take
the side perpendicular to your first, making an L around their corner.

```
O X .        they must now avoid every corner
X . .        3 of their 6 replies lose
. . .
```

| | |
|---|---|
| Lose | all three remaining corners |
| Safe | the centre, and two sides |
| Share | 3 of 6 |

**The punish is one square.** Whatever corner they take, you take the **centre**
and win in 2 — a fork twice, and a block that happens to fork on the third.

Your two marks do not form a line, which is what makes this quiet: there is
nothing on the board for them to block.

**Rejected alternative.** If they answer the side opening with the *centre* —
the likelier novice move — a trap also exists at 3 of 6, but its losing squares
are two sides and a corner. No rule, so it is not taught.

## Tutorial 4 — Going second

There is no winning strategy for the second player, and the tutorial says so in
its first line. Its subject is not losing.

1. **If they take a corner, take the middle or lose.** The centre is the only
   square that does not lose.
2. **If they take the middle, take a corner or lose.** Any of the four.
3. **Then watch for the traps from Tutorials 1 to 3** — the only positions where
   nothing needs blocking and you can still lose.
4. **Follow 1 and 2 and the draw is always there.** You can still throw it later;
   these rules only get you past the opening.

**The gap, stated rather than hidden.** A *side* opening is covered by neither
rule 1 nor rule 2, and it is the nastiest case to summarise: against it, two of
the four corners lose, and so do two of the three remaining sides. The safe set
— an adjacent corner, the opposite side, or the centre — is not a rule anyone
will remember. The tutorial says only this: **the middle is always safe there**,
and points at Tutorial 3 for what happens when you get it wrong.

**The suggested exercise.** The tutorial ends by telling the player to set
`Computer plays: X` with the **perfect** opponent and teaching mode on **Every
move**, then to break rule 1 on purpose and watch every square turn red. The
existing app is the exercise; no new UI is needed for it.

## The shape of a tutorial

```js
{
  id: 'centre-first',
  name: 'Centre first',
  summary: 'The deadliest trap: four of their six replies lose.',
  steps: [{ board, note }],     // the watch phase, in order
  practice: {
    playerMark: 'X',
    replies: [0, 1],            // what the opponent plays, in order
    goal: 'Win from the opening.',
  },
}
```

`steps` is a scripted history. That is deliberate: Phase 3's navigation already
walks an array of boards with a cursor, so the watch phase is that same
navigation driven by a different array. No second mechanism.

## The watch phase

Board, commentary, Back and Forward. The player steps through the line at their
own pace; the replay animation between steps is the one Phase 3 built.

**The engine is silent here.** No stars, no tints, no verdicts, no slip warnings
— regardless of the teaching dial. The tutorials are about what a *human*
opponent does wrong, which the solver has no concept of; its verdicts would talk
over the commentary and disagree with it, because the solver rates a trap square
by what perfect play does next, not by what a person does next.

## The practice phase

The player plays the line themselves, from an empty board, as X.

**The opponent is scripted, not played.** It walks into the trap every time,
because a lesson that fizzles teaches nothing: against the honest fallible
opponent, Tutorial 1's trap springs 69% of the time and Tutorial 3's only 31%,
so two attempts in three at Tutorial 3 would end in a quiet draw having
demonstrated nothing.

The opponent plays the first move in `replies` that is still legal. If the
player leaves the line, it falls back to any free square, and the tutorial
says which move was expected rather than silently continuing.

**The engine comes back on.** Once the board is live the player is in a normal
game, so the teaching dial and slip warnings apply as they do everywhere else.
The commentary taught the plan; the engine catches a fumbled execution.

## The unlock

Completing the practice phase records the tutorial's `id` in `localStorage` and
reveals **"Now try it against a fallible computer"** — which starts an ordinary
game with `Computer plays` set to the opposing mark and the difficulty on
fallible. No new game mode; it is the button the existing controls already
imply.

This is where the real odds live, and the tutorial should say them: this worked
every time a moment ago because the opponent was scripted, and it will not now.

## Placement

A **Learn** section on the start screen, beside the existing "Who are you
playing?", listing the four tutorials by name with their one-line summary and a
completion tick. A tutorial is not an opponent, so it does not belong in the
opponent radio group.

`App.jsx` gains one screen value. The tutorial screen is its own component; the
game screen is not modified to accommodate it.

## Carried debt

**`useGameHistory` extraction (ruling R10).** `Game.jsx` holds `history`,
`cursor`, `target`, the replay effect and the navigation helpers. The watch
phase needs all of it and none of the game around it, so this phase begins by
extracting the hook — the reviewer recommended it, and it now has a second
caller to justify it.

Two Phase 3 findings ride along: `records` storing an index and mark derivable
from adjacent positions, and the eight requests a nine-ply jump fires and
immediately aborts.

## Testing

The tutorial content is a factual claim about tic-tac-toe, so it is tested
against the solver rather than proof-read. For each attacking tutorial:

- the opponent's scripted reply is a **non-losing** move (the trap must catch a
  competent novice, not a blunderer);
- after the trap move, the position has **no block available** — the property
  the whole idea rests on;
- the stated losing squares lose and the stated safe squares do not;
- every losing reply is answered by the stated punish, and it wins;
- the losing set is **categorically clean** — every loser shares a description.

For Tutorial 4, that rules 1 and 2 name the only non-losing replies, and that
the five-trap enumeration still yields five. These are cheap exhaustive sweeps;
the engine is already tested this way.

Frontend: `game.js` gains the tutorial lookup and the scripted-opponent choice,
both pure and unit-tested. The screens are verified in the browser as in
Phases 2b and 3.

## Out of scope

In-app authoring. More tutorials. Symmetry handling — each tutorial is taught in
one fixed orientation, because a player learning "the opposite corner" does not
need eight rotations of it. Server-side progress. Any database.
