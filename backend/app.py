import random

from flask import Flask, Response, jsonify, request
from pydantic import ValidationError

from game import player_to_move
from game import status as board_status
from opponent import choose
from rules import name_move
from schemas import AnalyseRequest, AnalyseResponse, MoveAnalysis
from solver import analyse_moves

# In production one service serves both halves of the app: the Dockerfile drops
# the built React bundle into ./static and gunicorn serves it alongside /api, so
# the browser talks to a single origin and needs no Vite proxy and no CORS.
# static_url_path="" puts the bundle's files at the paths index.html asks for
# ("/assets/...", "/favicon.svg") instead of under a "/static" prefix. In
# development the directory is absent and Vite serves the frontend, so the
# static routes simply 404.
app = Flask(__name__, static_folder="static", static_url_path="")

# A board is nine cells and an opponent name; the largest legal request is a
# couple of hundred bytes. Without a cap Flask will read and parse a body of
# any size, so one client can spend the server's memory on nothing.
app.config["MAX_CONTENT_LENGTH"] = 4096

# SystemRandom rather than Random: this one generator is shared by every
# request, Flask's server is threaded, and random.Random carries mutable state
# that is not documented as safe for concurrent use — two players moving at the
# same moment could draw the same number. SystemRandom keeps no state, going to
# os.urandom per call. The opponent only asks it for `choice` and `random`.
_RNG = random.SystemRandom()


def _first_problem(error: ValidationError) -> str:
    """Render a validation failure as a message naming the field and the problem.

    Pydantic reports the offending field in `loc` and the reason in `msg`, and
    prefixes messages raised by custom validators with "Value error, ". Sending
    only `msg` would answer "Field required" without saying which field.

    Args:
        error: The exception raised by `model_validate`.

    Returns:
        A single-line message such as
        "board: List should have at least 9 items after validation, not 8".
    """
    first = error.errors()[0]
    location = ".".join(str(part) for part in first["loc"]) or "request body"
    return f"{location}: {first['msg'].removeprefix('Value error, ')}"


@app.post("/api/analyse")
def analyse() -> tuple[Response | dict[str, object], int]:
    """Analyse a board: what every legal move leads to, and what it is called.

    Returns:
        The analysis and HTTP 200, or an error message and HTTP 400 when the
        submitted board is malformed or unreachable.
    """
    try:
        payload = AnalyseRequest.model_validate(request.get_json(silent=True) or {})
    except ValidationError as error:
        return jsonify(error=_first_problem(error)), 400

    board = tuple(payload.board)
    status, winning_mark, winning_line = board_status(board)

    moves = (
        [
            MoveAnalysis(
                index=result.index,
                outcome=result.outcome,
                distance=result.distance,
                rule=name_move(board, result.index),
                best=result.best,
            )
            for result in analyse_moves(board)
        ]
        if status == "in_progress"
        else []
    )

    suggested = (
        choose(board, payload.opponent, _RNG)
        if payload.opponent is not None and status == "in_progress"
        else None
    )

    response = AnalyseResponse(
        status=status,
        player=player_to_move(board) if status == "in_progress" else None,
        winner=winning_mark,
        winning_line=list(winning_line) if winning_line else None,
        moves=moves,
        suggested=suggested,
    )
    return response.model_dump(), 200


@app.get("/")
def index() -> Response:
    """Serve the built frontend's entry page.

    Returns:
        The bundle's index.html, or HTTP 404 when no bundle has been built into
        ./static -- the normal case in development.
    """
    return app.send_static_file("index.html")


if __name__ == "__main__":
    # Loopback: debug=True serves the interactive debugger, which is a remote
    # code execution surface for anyone who can reach the port.
    app.run(host="127.0.0.1", port=5000, debug=True)
