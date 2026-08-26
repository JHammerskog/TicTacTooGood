import { Fragment } from 'react';

const MARK_OPTIONS = [
  { value: null, label: 'Off' },
  { value: 'X', label: 'X' },
  { value: 'O', label: 'O' },
];

/**
 * Who the computer is playing, or nobody. One three-way control rather than an
 * on/off switch plus a "goes first" switch, because naming the computer's mark
 * is what makes the mid-game case unambiguous: set it to the side that is to
 * move and the computer answers at once, set it to the other side and it waits
 * for you. "Goes first" has no meaning on a board that is already half played.
 *
 * Changing this takes effect immediately, so a hotseat position can be handed
 * over to the computer mid-game.
 */
export default function ComputerControl({ value, onChange }) {
  return (
    <fieldset>
      <legend className="fs-6 text-body-secondary">Computer plays</legend>
      <div className="btn-group" role="group">
        {MARK_OPTIONS.map((option) => (
          <Fragment key={option.label}>
            <input
              type="radio"
              className="btn-check"
              name="computer-mark"
              id={`computer-${option.label}`}
              autoComplete="off"
              checked={option.value === value}
              onChange={() => onChange(option.value)}
            />
            <label
              className="btn btn-outline-primary"
              htmlFor={`computer-${option.label}`}
            >
              {option.label}
            </label>
          </Fragment>
        ))}
      </div>
    </fieldset>
  );
}
