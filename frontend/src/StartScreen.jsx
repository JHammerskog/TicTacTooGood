import { Fragment } from 'react';
import CritiqueSwitch from './CritiqueSwitch.jsx';
import TeachingDial from './TeachingDial.jsx';

// Each option sets both halves of the opponent: who the computer plays as, and
// how well. The computer takes O so the player opens, which is the friendlier
// default; it can be handed either mark, or switched off, from the game screen.
const OPPONENTS = [
  {
    value: 'hotseat',
    label: 'Hotseat',
    hint: 'Two players, one screen.',
    settings: { computerMark: null },
  },
  {
    value: 'fallible',
    label: 'Computer — fallible',
    hint: 'Takes a win, never misses a block — after that it guesses.',
    settings: { computerMark: 'O', difficulty: 'fallible' },
  },
  {
    value: 'perfect',
    label: 'Computer — perfect',
    hint: 'Cannot be beaten. A draw is the win.',
    settings: { computerMark: 'O', difficulty: 'perfect' },
  },
];

function StartScreen({ settings, onChange, onStart, onBack }) {
  const chosen =
    settings.computerMark === null ? 'hotseat' : settings.difficulty;

  return (
    <div className="text-center">
      <h1 className="mb-2">Play a game</h1>
      <p className="text-body-secondary mb-4">
        Set it up however you like — all of this can be changed mid-game too.
      </p>
      <div className="d-inline-block text-start">
        <fieldset className="mb-4">
          <legend className="fs-6 text-body-secondary">
            Who are you playing?
          </legend>
          <div className="d-grid gap-2">
            {OPPONENTS.map((option) => (
              <Fragment key={option.value}>
                <input
                  type="radio"
                  className="btn-check"
                  name="opponent"
                  id={`opponent-${option.value}`}
                  autoComplete="off"
                  checked={option.value === chosen}
                  onChange={() =>
                    onChange((previous) => ({
                      ...previous,
                      ...option.settings,
                    }))
                  }
                />
                <label
                  className="btn btn-outline-primary text-start"
                  htmlFor={`opponent-${option.value}`}
                >
                  <strong>{option.label}</strong>
                  <br />
                  <small>{option.hint}</small>
                </label>
              </Fragment>
            ))}
          </div>
        </fieldset>
        <TeachingDial
          value={settings.teaching}
          onChange={(teaching) =>
            onChange((previous) => ({ ...previous, teaching }))
          }
          describe
        />
        <div className="mt-3">
          <CritiqueSwitch
            value={settings.critique}
            onChange={(critique) =>
              onChange((previous) => ({ ...previous, critique }))
            }
            describe
          />
        </div>
      </div>
      <div className="d-flex justify-content-center gap-2 mt-4">
        <button
          type="button"
          className="btn btn-primary btn-lg"
          onClick={onStart}
        >
          Start game
        </button>
        <button
          type="button"
          className="btn btn-outline-secondary btn-lg"
          onClick={onBack}
        >
          Back
        </button>
      </div>
    </div>
  );
}

export default StartScreen;
