# CLAUDE.md

Guidance for Claude Code when working on TicTacTooGood.

## Project

A tic-tac-toe app whose real purpose is teaching the player the simple
patterns/rules that matter in the game — not just letting them play. Also a
vehicle for learning React (frontend) from a Flask/Jinja/raw-JS background.
Phased build: see `docs/superpowers/specs/` for phase design docs.

## Collaboration preferences

- When in doubt about what to do, ask.
- Never run git commands that write state (`add`, `commit`, `branch`,
  `push`, etc.) — the user always handles staging, commits, branches, and
  pushes. Read-only git commands (`status`, `log`, `diff`) are fine.
- Environment-modifying commands (installs, `$PATH`/dotfile edits) —
  explain what's needed and why, give the exact command, let the user run
  it. Don't auto-run.
- Be concise.
- Explain React concepts as they're introduced — ideally mapped to the
  closest Flask/Jinja/raw-JS equivalent, since that's the background here.
  Don't just implement a React pattern; say what it's called, what problem
  it solves, and how it differs from the server-rendered equivalent.
- At the start of each new phase, ask what specifically matters to the user
  and what they want out of that phase's functionality before implementing.

## Code style

### Python (backend)

- Modern Python, type hints required on all functions.
- Group imports: standard library, third-party, local.
- Docstrings: triple-quoted, with args/returns, on all functions.
- No duplicated code, no unnecessary dependencies.
- Structure for readability, testability, maintainability.
- Comments explain code to another developer, not restate it.
- Dependencies managed with `uv` (`pyproject.toml` + `uv.lock`), not pip/requirements.txt.
- Linting/formatting: Ruff (replaces separate linter + formatter — one tool,
  one config, in `pyproject.toml`).

### JavaScript / React (frontend)

- ES6+ features, semicolons required.
- Flask is API-only here — no server-rendered templates, so there's no
  Jinja2/`.html.j2` section like other projects might have.
- Formatting: Prettier, default config (2-space indent).

### Frontend styling

- Bootstrap 5 utilities first; custom CSS only for what Bootstrap doesn't
  cover.
- Consistent color scheme and typography across the app.
- Simple, user-friendly, responsive; follow WCAG accessibility basics.
- Meaningful error messages/feedback; loading indicators for anything
  async.

### Data validation

- Use Pydantic for Flask API request/response schemas; validate all user
  input server-side even though there's no shared type system with the
  frontend.

### Database

- Not in use through Phase 0–2. If Phase 3 needs persistence, revisit this
  section — likely SQLAlchemy models with auto-generated migrations
  (never hand-written), cascade deletes where appropriate.

### Testing

- Test behavior/requirements, not implementation details.
- Test a module's public API, not its internals.
- Tests are long-term infrastructure with a real cost — use judgement on
  whether a given test is worth writing, especially at this project's
  scale.
- Fix a broken test immediately, even if you didn't cause the break.

### Debugging

- Check container logs: `docker-compose logs -f <service>`
- Flask debug mode: enabled by default in local development.
