import pytest
from flask.testing import FlaskClient

from app import app


@pytest.fixture
def client() -> FlaskClient:
    """Provide a Flask test client for the API."""
    app.config["TESTING"] = True
    return app.test_client()


def cells(text: str) -> list[str | None]:
    """Build a request board from a 9-character string, '.' meaning empty."""
    return [None if cell == "." else cell for cell in text]


def test_empty_board_returns_nine_drawing_moves(client: FlaskClient) -> None:
    response = client.post("/api/analyse", json={"board": cells(".........")})
    assert response.status_code == 200
    body = response.get_json()
    assert body["status"] == "in_progress"
    assert body["player"] == "X"
    assert body["winner"] is None
    assert body["winning_line"] is None
    assert len(body["moves"]) == 9
    assert {move["outcome"] for move in body["moves"]} == {"draw"}


def test_every_move_carries_a_rule_name(client: FlaskClient) -> None:
    response = client.post("/api/analyse", json={"board": cells(".........")})
    moves = response.get_json()["moves"]
    assert {move["rule"] for move in moves} == {"centre", "empty_corner", "empty_side"}
    assert next(move for move in moves if move["index"] == 4)["rule"] == "centre"


def test_a_won_board_reports_the_winner_and_no_moves(client: FlaskClient) -> None:
    response = client.post("/api/analyse", json={"board": cells("XXXOO....")})
    assert response.status_code == 200
    body = response.get_json()
    assert body["status"] == "won"
    assert body["winner"] == "X"
    assert body["winning_line"] == [0, 1, 2]
    assert body["player"] is None
    assert body["moves"] == []


def test_a_drawn_board_reports_drawn_and_no_moves(client: FlaskClient) -> None:
    response = client.post("/api/analyse", json={"board": cells("XXOOOXXOX")})
    assert response.status_code == 200
    body = response.get_json()
    assert body["status"] == "drawn"
    assert body["winner"] is None
    assert body["moves"] == []


def test_a_short_board_is_rejected(client: FlaskClient) -> None:
    response = client.post("/api/analyse", json={"board": cells("........")})
    assert response.status_code == 400
    assert response.get_json()["error"]


def test_a_long_board_is_rejected(client: FlaskClient) -> None:
    response = client.post("/api/analyse", json={"board": ["X"] * 10})
    assert response.status_code == 400


def test_an_impossible_move_count_is_rejected(client: FlaskClient) -> None:
    response = client.post("/api/analyse", json={"board": cells("XXX......")})
    assert response.status_code == 400
    assert "X" in response.get_json()["error"]


def test_a_board_with_two_winners_is_rejected(client: FlaskClient) -> None:
    response = client.post("/api/analyse", json={"board": cells("XXXOOO...")})
    assert response.status_code == 400


def test_a_missing_body_is_rejected(client: FlaskClient) -> None:
    response = client.post("/api/analyse", json={})
    assert response.status_code == 400
    # The message must name the field, not just say "Field required".
    assert "board" in response.get_json()["error"]


def test_no_opponent_means_no_suggestion(client: FlaskClient) -> None:
    response = client.post("/api/analyse", json={"board": cells(".........")})
    assert response.get_json()["suggested"] is None


def test_an_opponent_gets_a_legal_suggestion(client: FlaskClient) -> None:
    response = client.post(
        "/api/analyse",
        json={"board": cells("XX.OO...."), "opponent": "fallible"},
    )
    assert response.status_code == 200
    body = response.get_json()
    assert body["suggested"] in {move["index"] for move in body["moves"]}


def test_a_fallible_opponent_takes_the_win_in_front_of_it(client: FlaskClient) -> None:
    """X to play with 2 completing the top row. Fallible's first rule is to
    win, so this is not left to chance."""
    response = client.post(
        "/api/analyse",
        json={"board": cells("XX.OO...."), "opponent": "fallible"},
    )
    assert response.get_json()["suggested"] == 2


def test_a_finished_game_suggests_nothing(client: FlaskClient) -> None:
    response = client.post(
        "/api/analyse",
        json={"board": cells("XXXOO...."), "opponent": "perfect"},
    )
    body = response.get_json()
    assert body["status"] == "won"
    assert body["moves"] == []
    assert body["suggested"] is None


def test_an_unknown_opponent_is_rejected(client: FlaskClient) -> None:
    response = client.post(
        "/api/analyse",
        json={"board": cells("........."), "opponent": "telepathic"},
    )
    assert response.status_code == 400
    assert "opponent" in response.get_json()["error"]
