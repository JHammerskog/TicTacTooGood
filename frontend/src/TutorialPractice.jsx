import { useEffect, useState } from 'react';
import Board from './Board.jsx';
import { useGameHistory } from './useGameHistory.js';
import { scriptedReply, expectedMove } from './tutorials.js';
import {
  CELL_NAMES,
  calculateWinner,
  isOver,
  nextPlayer,
  THINKING_MS,
  winningSquares,
} from './game.js';
import { playPencil } from './sound.js';

/**
 * The player runs the line themselves.
 *
 * The opponent is scripted rather than played. Against the honest fallible
 * opponent a trap springs well under half the time on two of the three lessons,
 * so most attempts would end in a quiet draw having demonstrated nothing. The
 * real odds belong in the game that unlocks afterwards, and Tutorial.jsx is
 * where they are quoted — nothing measures them, so one hand-written figure is
 * one too many to keep in step.
 */
export default function TutorialPractice({ tutorial, muted, onWin }) {
  const [hint, setHint] = useState(null);
  const { squares, lastMove, playAt, reset } = useGameHistory(() => {
    if (!muted) {
      playPencil();
    }
  });

  const winner = calculateWinner(squares);
  const over = isOver(squares);
  const player = nextPlayer(squares);
  const theirTurn = !over && player !== tutorial.mark;
  const won = winner?.player === tutorial.mark;

  useEffect(() => {
    if (!theirTurn) {
      return undefined;
    }
    const timer = setTimeout(() => {
      const index = scriptedReply(squares, tutorial.practice.replies);
      if (index >= 0) {
        playAt(index, player);
      }
    }, THINKING_MS);
    return () => clearTimeout(timer);
    // `playAt` is recreated every render; listing it would restart the timer on
    // every render rather than only when the turn changes.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [theirTurn, squares]);

  useEffect(() => {
    if (won) {
      onWin();
    }
    // `onWin` is recreated on every render, so listing it would re-run this
    // effect on every render rather than only when `won` changes; recording
    // completion is idempotent, so only `won` should retrigger it.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [won]);

  // What the line calls for in this position. Computed once per render and used
  // twice: to highlight the square, and to name it in the hint if the player
  // presses somewhere else. The board cannot change between those two, because
  // a click is what changes it.
  const wanted = expectedMove(squares, tutorial);

  // Only reachable for a legal click: `Board` refuses an occupied cell and
  // everything the `disabled` prop below covers.
  function handleCellClick(index) {
    // The hint names the move rather than refusing the click: being told what
    // the line wanted teaches more than a square that will not accept a press,
    // and the player can always start over.
    setHint(
      wanted !== null && wanted !== index
        ? `The line goes ${CELL_NAMES[wanted]} here. Play on, or start over.`
        : null,
    );
    playAt(index, tutorial.mark);
  }

  // The same orange guidance the walkthrough gives, carried into the exercise.
  // `expectedMove` covers the opening, the trap and the punish; it returns null
  // at the last move because the punish is a fork and two squares win, so those
  // are highlighted instead. Nothing is shown while it is their turn.
  // `!== null` rather than a truthiness test: cell 0 is a real square.
  const guide =
    over || theirTurn
      ? []
      : wanted !== null
        ? [wanted]
        : winningSquares(squares, tutorial.mark);
  const highlight = Object.fromEntries(guide.map((index) => [index, 'next']));

  let status;
  if (won) {
    status = 'That is the trap, exactly as taught.';
  } else if (over) {
    status = 'Not this time — start over and follow the line.';
  } else {
    // The goal stays put while they answer. Swapping it for "They answer…" cost
    // the player the one line telling them what they are trying to do, for the
    // 400ms it takes the scripted opponent to reply.
    status = tutorial.practice.goal;
  }

  return (
    <div className="text-center">
      <p className="fs-5" aria-live="polite">
        {status}
      </p>
      {/* Engine-silent here too, and deliberately: after their blunder a star
          would sit on the punish square — the one move this whole exercise
          exists to make the player find. The hint below covers the "caught
          fumbling" case instead, and names what the LINE wanted rather than
          what the solver wants. */}
      <Board
        squares={squares}
        winningLine={winner?.line}
        lastMove={lastMove}
        disabled={over || theirTurn}
        onPlay={handleCellClick}
        teaching="off"
        highlight={highlight}
      />
      <div className="message-slot mx-auto mt-3">
        {hint && !won && (
          <div className="alert alert-warning text-start" role="alert">
            {hint}
          </div>
        )}
        {won && (
          <div className="alert alert-success text-start" role="alert">
            Done. This worked every time because the opponent was scripted to
            walk into it — against a real player it will not.
          </div>
        )}
      </div>
      <button
        type="button"
        className="btn btn-outline-secondary btn-sm"
        onClick={() => {
          setHint(null);
          reset();
        }}
      >
        Start over
      </button>
    </div>
  );
}
