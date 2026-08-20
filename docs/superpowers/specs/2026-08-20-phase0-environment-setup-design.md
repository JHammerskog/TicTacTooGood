# Phase 0: Environment Setup — Design

## Project context

TicTacTooGood is a tic-tac-toe app whose real purpose is teaching the player
the simple patterns/rules that matter in the game (not just letting them
play). It's also a vehicle for learning React from a Flask/Jinja/raw-JS
background. Planned phases:

- **Phase 0** (this spec): tooling installed, hello-world skeleton proving
  the stack talks to itself.
- **Phase 1**: playable tic-tac-toe, responsive UI, new-game button, no DB.
- **Phase 2**: the solver — surfaces the tips/rules that are the app's point.
- **Phase 3**: not yet designed — likely multiple concurrent games,
  possibly login/stateful persistence.

Only Phase 0 is scoped here. Later phases get their own spec when reached.

## Goal

Prove the full stack works end-to-end, locally, via Docker, with all tooling
installed — before any real game logic is written.

**Done means:** `docker-compose up` starts two containers; visiting the
frontend shows a page that fetched and displays a message from the backend.

## Architecture

```
TicTacTooGood/
├── frontend/          # React app (Vite, JavaScript)
├── backend/           # Flask app (uv-managed)
├── docker-compose.yml
└── CLAUDE.md          # project conventions/preferences (written separately)
```

Two containers, defined in one `docker-compose.yml`, started together with a
single `docker-compose up`:

- **frontend** — runs Vite's dev server (hot module reloading: editing a
  component updates the browser instantly, no full reload).
- **backend** — runs Flask's dev server via `uv run flask run`.

They're split because they're different runtimes (Node vs Python) doing
non-overlapping jobs, not because the application is conceptually two
things. This also matches how the real deployment would eventually be
shaped, more so than a single mixed-runtime container would.

## Data flow (hello-world proof)

- Backend exposes `GET /api/hello` → `{"message": "Hello from Flask"}`.
- Frontend fetches it once on page load (`useEffect`) and stores/displays it
  (`useState`). Unlike Jinja, which injects the value into HTML before the
  server sends the page, React's page loads first and then asks for the
  value — the fetched piece re-renders in place once it arrives.

## Tooling choices

| Concern | Choice | Why |
|---|---|---|
| Frontend scaffold | Vite, plain JavaScript | Vite is the current standard (Create React App is deprecated). JS (not TS) keeps one fewer new concept while learning React itself. |
| Backend framework | Flask | Matches existing background — keeps backend friction near zero so learning effort goes to React. |
| Python dependency mgmt | uv | Single fast tool replacing pip + venv + pip-tools; deps in `backend/pyproject.toml`, pinned in `backend/uv.lock`; `uv sync` + `uv run` replace manual venv activation. |
| Containers | docker-compose, 2 services | One command (`docker-compose up`) starts both; runtimes stay isolated and independently restartable/debuggable. |
| Python lint/format | Ruff | One tool, one config (`pyproject.toml`), replaces separate linter + formatter. |
| JS/React format | Prettier | Default config (2-space indent). |
| Frontend styling | Bootstrap 5 | Utility-first, decided by user; custom CSS only where Bootstrap doesn't cover it. |

## Environment audit (as of 2026-08-20)

Checked on this machine before writing this spec:

| Tool | Status |
|---|---|
| Python 3.14.4 | installed |
| Node v22.22.1 | installed |
| npm | **missing** — installed `nodejs` package is Ubuntu's own repo build (not NodeSource's), and Ubuntu splits `npm` into a separate package that isn't pulled in automatically |
| Docker | **not installed** |
| uv | **not installed** |

Phase 0 implementation must install: Docker (+ compose plugin), npm, and uv,
then scaffold both apps, then add and configure Ruff (backend) and Prettier
(frontend), then add Bootstrap 5 to the frontend (installed and importable —
not styled UI yet).

## Out of scope for Phase 0

No game logic, no database, no actual Bootstrap-styled UI (just proving it's
installed/importable), no tests. Purely: tooling installed, lint/format
configured, stack proven to talk to itself.

## Testing

None for Phase 0 — nothing worth testing yet beyond "the hello-world message
renders," which is verified manually by loading the page.
