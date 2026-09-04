# Production image, used by Railway. Docker Compose still builds the two
# dev images in backend/ and frontend/ -- this file is only for deployment,
# where the app runs as a single service on a single port.

# Stage 1: build the React bundle. Nothing from this stage's toolchain
# (node, node_modules) reaches the final image -- only dist/.
FROM node:22-slim AS frontend
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
# ci, not install: installs exactly the lockfile's versions and fails if
# package.json and the lockfile disagree, so a deploy can't silently drift.
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: the runtime. Same base as the dev backend image.
FROM python:3.14-slim
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/
WORKDIR /app
COPY backend/pyproject.toml backend/uv.lock ./
# --no-dev: pytest and ruff are build-time tools, not runtime ones.
RUN uv sync --frozen --no-dev
COPY backend/ ./
COPY --from=frontend /app/dist ./static

# A shell is needed because Railway assigns the port to listen on in $PORT at
# runtime and only a shell expands it; the fallback keeps a plain `docker run`
# working locally, where nothing sets it. `exec` then replaces the shell with
# gunicorn so gunicorn is PID 1 and receives the SIGTERM Railway sends on
# shutdown -- a bare `CMD gunicorn ...` leaves the shell holding PID 1, which
# swallows the signal and turns every redeploy into a hard kill. Calling the
# venv's gunicorn directly, rather than `uv run`, keeps it to one process.
CMD ["sh", "-c", "exec /app/.venv/bin/gunicorn app:app --bind 0.0.0.0:${PORT:-8000}"]
