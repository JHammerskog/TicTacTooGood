FROM python:3.14-slim
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen
COPY . .
# --reload, not --debug: the source is bind-mounted so the reloader is wanted,
# but --debug also serves the Werkzeug interactive debugger, which executes
# arbitrary Python for anyone who can reach the port.
CMD ["uv", "run", "flask", "--app", "app", "run", "--host=0.0.0.0", "--port=5000", "--reload"]
