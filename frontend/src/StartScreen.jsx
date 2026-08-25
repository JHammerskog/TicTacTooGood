import { TeachingDial } from './TeachingPanel.jsx';

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
              <button
                key={option.value}
                type="button"
                className={
                  option.value === settings.opponent
                    ? 'btn btn-primary text-start'
                    : 'btn btn-outline-primary text-start'
                }
                aria-pressed={option.value === settings.opponent}
                onClick={() =>
                  onChange((previous) => ({
                    ...previous,
                    opponent: option.value,
                  }))
                }
              >
                <strong>{option.label}</strong>
                <br />
                <small>{option.hint}</small>
              </button>
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
