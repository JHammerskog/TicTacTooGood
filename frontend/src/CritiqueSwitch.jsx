/**
 * The "warn me after a bad move" switch. Lives in its own component because it
 * appears in two places — the start screen, where there is no board yet, and
 * beside the board in-game, where turning it off mid-game is the point.
 *
 * `describe` adds the explanatory line, on the same terms as TeachingDial's:
 * the start screen needs it, the game screen has the board to speak for it.
 */
export default function CritiqueSwitch({ value, onChange, describe = false }) {
  return (
    <div>
      <div className="form-check form-switch d-inline-flex align-items-center gap-2">
        <input
          className="form-check-input"
          type="checkbox"
          role="switch"
          id="critique"
          checked={value}
          onChange={() => onChange(!value)}
        />
        <label className="form-check-label" htmlFor="critique">
          Tell me when I slip
        </label>
      </div>
      {describe && (
        <p className="text-body-secondary small mb-0">
          Warns after a move that throws the game, and offers to take it back.
        </p>
      )}
    </div>
  );
}
