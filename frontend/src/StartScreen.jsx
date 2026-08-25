import { Fragment } from 'react';
import TeachingDial from './TeachingDial.jsx';

const OPPONENTS = [
  { value: 'hotseat', label: 'Hotseat', hint: 'Two players, one screen.' },
  {
    value: 'fallible',
    label: 'Computer — fallible',
    hint: 'Takes a win, never misses a block — after that it guesses.',
  },
  {
    value: 'perfect',
    label: 'Computer — perfect',
    hint: 'Cannot be beaten. A draw is the win.',
  },
];

function StartScreen({ settings, onChange, onStart }) {
  return (
    <div className="text-center">
      <h1 className="mb-2">TicTacTooGood</h1>
      <p className="text-body-secondary fs-5 mb-4">
        Learn the patterns that decide the game.
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
                  checked={option.value === settings.opponent}
                  onChange={() =>
                    onChange((previous) => ({
                      ...previous,
                      opponent: option.value,
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
          <div className="form-check form-switch d-inline-flex align-items-center gap-2">
            <input
              className="form-check-input"
              type="checkbox"
              role="switch"
              id="critique"
              checked={settings.critique}
              onChange={() =>
                onChange((previous) => ({
                  ...previous,
                  critique: !previous.critique,
                }))
              }
            />
            <label className="form-check-label" htmlFor="critique">
              Tell me when I slip
            </label>
          </div>
          <p className="text-body-secondary small mb-0">
            Warns after a move that throws the game, and offers to take it back.
          </p>
        </div>
      </div>
      <div>
        <button
          type="button"
          className="btn btn-primary btn-lg mt-3"
          onClick={onStart}
        >
          Start game
        </button>
      </div>
    </div>
  );
}

export default StartScreen;
