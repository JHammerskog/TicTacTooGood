/**
 * The controls that belong to the app rather than to a game: they sit above
 * both screens and survive navigation between them.
 */
function ThemeControls({ theme, onTheme, muted, onMuted }) {
  const dark = theme === 'dark';
  return (
    <div className="d-flex justify-content-end gap-3 mb-2">
      <div className="form-check form-switch mb-0">
        <input
          className="form-check-input"
          type="checkbox"
          role="switch"
          id="theme-switch"
          checked={dark}
          onChange={() => onTheme(dark ? 'light' : 'dark')}
        />
        <label className="form-check-label small" htmlFor="theme-switch">
          Dark
        </label>
      </div>
      <div className="form-check form-switch mb-0">
        <input
          className="form-check-input"
          type="checkbox"
          role="switch"
          id="sound-switch"
          checked={!muted}
          onChange={() => onMuted(!muted)}
        />
        <label className="form-check-label small" htmlFor="sound-switch">
          Sound
        </label>
      </div>
    </div>
  );
}

export default ThemeControls;
