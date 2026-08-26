# TicTacTooGood

To help an aspiring tic-tac-toe champion in their quest for total domination.

A tic-tac-toe app that teaches. A solver evaluates every legal move, so the
board can show you which squares hold the win, name the pattern behind them,
warn you the moment you throw the game, and walk you back through your
mistakes when it is over.

![A warning about the move just played, the losing line, and a review naming the mistake](docs/screenshot.png)

## Quick start

With [Docker](https://docs.docker.com/get-docker/):

```bash
docker compose up
```

Then open <http://localhost:5173>.

### Without Docker

Needs [Node 22+](https://nodejs.org) and [uv](https://docs.astral.sh/uv/).
Run each in its own terminal:

```bash
cd backend  && uv run flask --app app run --port 5000   # API
cd frontend && npm install && npm run dev               # UI on :5173
```

Vite proxies `/api` to the backend, so use `http://localhost:5173` either way.

## How it works

The backend solves the position by minimax over all 5,478 reachable boards and
returns a verdict for every legal move. The frontend plays the game and renders
that verdict.

```
backend/    Flask API + solver      frontend/   React + Vite
  solver.py   minimax                 game.js     rules, history, judgement
  rules.py    names each move         Game.jsx    the game screen
  opponent.py perfect and fallible    Board.jsx   the board
  app.py      POST /api/analyse
```

## Tests

```bash
cd backend  && uv run pytest && uv run ruff check .
cd frontend && npm test && npm run lint
```
