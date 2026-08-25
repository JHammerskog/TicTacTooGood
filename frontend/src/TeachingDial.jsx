import { Fragment } from 'react';

const DIAL_OPTIONS = [
  {
    value: 'off',
    label: 'Off',
    hint: 'Just play. The board tells you nothing.',
  },
  {
    value: 'hints',
    label: 'Best move',
    hint: 'Stars the strongest move and names the pattern behind it.',
  },
  {
    value: 'full',
    label: 'Every move',
    hint: 'Rates every square: what it leads to and what it is called.',
  },
];

/**
 * The three-position teaching control. Three positions rather than two
 * checkboxes because "every move" strictly contains "best move" — two
 * checkboxes would imply four states where there are three.
 *
 * `describe` adds a line explaining the chosen setting. The start screen wants
 * it, because there is no board on screen to make the setting self-evident;
 * in-game the board is right there, so the dial stays compact.
 */
export default function TeachingDial({ value, onChange, describe = false }) {
  const chosen = DIAL_OPTIONS.find((option) => option.value === value);

  return (
    <fieldset className="mb-3">
      <legend className="fs-6 text-body-secondary">Teaching mode</legend>
      <div className="btn-group" role="group">
        {DIAL_OPTIONS.map((option) => (
          <Fragment key={option.value}>
            <input
              type="radio"
              className="btn-check"
              name="teaching-mode"
              id={`teaching-${option.value}`}
              autoComplete="off"
              checked={option.value === value}
              onChange={() => onChange(option.value)}
            />
            <label
              className="btn btn-outline-primary"
              htmlFor={`teaching-${option.value}`}
            >
              {option.label}
            </label>
          </Fragment>
        ))}
      </div>
      {describe && (
        <p className="text-body-secondary small mt-2 mb-0" aria-live="polite">
          {chosen?.hint}
        </p>
      )}
    </fieldset>
  );
}
