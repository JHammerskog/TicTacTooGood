import { useState } from 'react';
import TutorialPractice from './TutorialPractice.jsx';
import TutorialWatch from './TutorialWatch.jsx';
import { findTutorial } from './tutorials.js';

/**
 * One tutorial, in two phases: watch the line, then play it.
 *
 * "Going second" has no line to play, so it shows its rules and finishes there.
 */
export default function Tutorial({ id, muted, onPlayForReal, onQuit }) {
  const tutorial = findTutorial(id);
  const [phase, setPhase] = useState('watch');
  // Whether the player has just run the line successfully. Deliberately not
  // persisted: the app tracks no per-player progress, because localStorage
  // would be per-browser rather than per-person and would quietly mean
  // something different the moment this is hosted for more than one player.
  const [won, setWon] = useState(false);

  if (!tutorial) {
    return (
      <div className="text-center">
        <p>That tutorial does not exist.</p>
        <button type="button" className="btn btn-primary" onClick={onQuit}>
          Back to tutorials
        </button>
      </div>
    );
  }

  return (
    <div className="text-center">
      <h1 className="mb-1">{tutorial.name}</h1>
      <p className="text-body-secondary small mb-4">{tutorial.summary}</p>

      {tutorial.rules ? (
        <div className="mx-auto text-start" style={{ maxWidth: '40rem' }}>
          <ol className="list-group list-group-numbered">
            {tutorial.rules.map((rule) => (
              <li key={rule} className="list-group-item">
                {rule}
              </li>
            ))}
          </ol>
          <p className="text-body-secondary mt-3">
            Want to see it for yourself? Start a game, set{' '}
            <strong>Computer plays</strong> to <strong>X</strong> with the{' '}
            <strong>perfect</strong> opponent and teaching on{' '}
            <strong>Every move</strong>, then break rule 1 on purpose and watch
            every square turn red.
          </p>
          <button
            type="button"
            className="btn btn-primary mt-2"
            onClick={onQuit}
          >
            Got it
          </button>
        </div>
      ) : phase === 'watch' ? (
        <TutorialWatch
          tutorial={tutorial}
          muted={muted}
          onFinish={() => setPhase('practice')}
        />
      ) : (
        <TutorialPractice
          tutorial={tutorial}
          muted={muted}
          onWin={() => setWon(true)}
        />
      )}

      {won && tutorial.practice && (
        <div className="mt-4">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onPlayForReal(tutorial.mark)}
          >
            Now try it against a fallible computer
          </button>
          <p className="text-body-secondary small mt-2 mb-0">
            It falls for Centre first about two times in three, and for Corner
            first and Side first about one in three. That is the honest rate.
          </p>
        </div>
      )}

      <div className="mt-4">
        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={onQuit}
        >
          Back to tutorials
        </button>
      </div>
    </div>
  );
}
