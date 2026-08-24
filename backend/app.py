from flask import Flask, Response, jsonify, request
from flask_cors import CORS
from pydantic import ValidationError

from game import player_to_move
from game import status as board_status
from rules import name_move
from schemas import AnalyseRequest, AnalyseResponse, MoveAnalysis
from solver import analyse_moves

app = Flask(__name__)
CORS(app)


@app.route("/api/hello")
def hello() -> tuple[Response, int]:
    """Return a hello-world payload proving the backend is reachable.

    Returns:
        A JSON-serializable dict with a "message" key, and HTTP 200.
    """
    return jsonify(message="Hello from Flask"), 200


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

    response = AnalyseResponse(
        status=status,
        player=player_to_move(board) if status == "in_progress" else None,
        winner=winning_mark,
        winning_line=list(winning_line) if winning_line else None,
        moves=moves,
    )
    return response.model_dump(), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
