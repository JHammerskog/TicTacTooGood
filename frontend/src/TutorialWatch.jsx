import { useState } from 'react';
import Board from './Board.jsx';
import { playPencil } from './sound.js';

/**
 * Highlights for one step of a walkthrough.
 *
 * Before the trap is set, one yellow square says where the move the commentary
 * is describing will go. Without it the board lags the words by a turn: the
 * note says "you take the centre" while the board still shows nothing.
 *
 * On the final step the move is made and the trap is sprung, so the highlight
 * switches to the verdict on each of their replies — red where they lose, green
 * where they survive. Both come from the tutorial's own data, checked against
 * the solver by the backend, not from a live engine call.
 *
 * @param {object} tutorial - The tutorial being walked through.
 * @param {number} step - Which step is on screen, from 0.
 * @param {boolean} last - Whether this is the final step.
 * @returns {Record<number, 'next' | 'good' | 'bad'>} Cell index to highlight.
 */
function highlightsFor(tutorial, step, last) {
  if (!last) {
    const next = tutorial.line[step];
    return next === undefined ? {} : { [next]: 'next' };
  }
  return Object.fromEntries([
    ...tutorial.losing.map((index) => [index, 'bad']),
    ...tutorial.safe.map((index) => [index, 'good']),
  ]);
}

/**
 * The walkthrough. One scripted position at a time, with the commentary for
 * reaching it.
 *
 * `Board` gets no `moves` and `teaching="off"`, so the engine says nothing here:
 * the solver rates a square by what perfect play does next, and these lessons
 * are about what a person does next, so its annotations would contradict the
 * commentary. The highlights above are the tutorial's own voice, not the
 * engine's.
 *
 * `lastMove` is deliberately not passed. Its yellow would collide with the
 * yellow that now means "play here", and in a walkthrough where to go next
 * matters more than where you have been — the note already says that.
 */
export default function TutorialWatch({ tutorial, muted, onFinish }) {
  const [step, setStep] = useState(0);
  const current = tutorial.steps[step];
  const last = step === tutorial.steps.length - 1;

  function go(next) {
    if (!muted) {
      playPencil();
    }
    setStep(next);
  }

  return (
    <div className="text-center">
      <Board
        squares={current.board}
        winningLine={null}
        lastMove={null}
        disabled
        onPlay={() => {}}
        teaching="off"
        highlight={highlightsFor(tutorial, step, last)}
      />
      <div className="message-slot mx-auto mt-3 text-start">
        <p aria-live="polite">{current.note}</p>
        {last && (
          <p className="text-body-secondary small mb-0">
            Red squares lose for them. Green squares survive.
          </p>
        )}
      </div>
      {/* The walkthrough only moves when the reader presses Forward, so this
          is the one control that has to be obvious. Forward carries the solid
          fill until the last step, where it goes flat and "Now you try" takes
          over as the thing to press. */}
      <div className="d-flex justify-content-center align-items-center gap-3">
        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={() => go(step - 1)}
          disabled={step === 0}
        >
          ← Back
        </button>
        <span
          className="text-body-secondary small"
          style={{ minWidth: '5rem' }}
        >
          Step {step + 1} of {tutorial.steps.length}
        </span>
        <button
          type="button"
          className={`btn btn-lg ${last ? 'btn-outline-secondary' : 'btn-primary'}`}
          onClick={() => go(step + 1)}
          disabled={last}
        >
          Forward →
        </button>
      </div>
      {last && (
        <button
          type="button"
          className="btn btn-primary mt-4"
          onClick={onFinish}
        >
          Now you try
        </button>
      )}
    </div>
  );
}
