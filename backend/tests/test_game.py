from conftest import board

from game import (
    legal_moves,
    opponent,
    place,
    play,
    player_to_move,
    status,
    winner,
)


def test_winner_finds_a_row() -> None:
    assert winner(board("XXX.O.O..")) == ("X", (0, 1, 2))


def test_winner_finds_a_column() -> None:
    assert winner(board("X.OX.OX..")) == ("X", (0, 3, 6))


def test_winner_finds_a_diagonal() -> None:
    assert winner(board("X..OXO..X")) == ("X", (0, 4, 8))


def test_winner_reports_o_as_well_as_x() -> None:
    assert winner(board("OOOXX.X..")) == ("O", (0, 1, 2))


def test_empty_board_has_no_winner() -> None:
    assert winner(board(".........")) is None


def test_full_board_can_have_no_winner() -> None:
    assert winner(board("XXOOOXXOX")) is None


def test_legal_moves_lists_empty_cells_in_order() -> None:
    assert legal_moves(board("X.O.X...O")) == (1, 3, 5, 6, 7)


def test_legal_moves_is_empty_on_a_full_board() -> None:
    assert legal_moves(board("XXOOOXXOX")) == ()


def test_x_moves_first() -> None:
    assert player_to_move(board(".........")) == "X"


def test_o_moves_after_one_mark() -> None:
    assert player_to_move(board("X........")) == "O"


def test_x_moves_again_after_two_marks() -> None:
    assert player_to_move(board("XO.......")) == "X"


def test_opponent_flips_the_mark() -> None:
    assert opponent("X") == "O"
    assert opponent("O") == "X"


def test_place_puts_the_given_mark_at_the_index() -> None:
    assert place(board("........."), 4, "O") == board("....O....")


def test_place_does_not_mutate_the_original() -> None:
    original = board(".........")
    place(original, 0, "X")
    assert original == board(".........")


def test_play_uses_the_player_to_move() -> None:
    assert play(board("........."), 0) == board("X........")
    assert play(board("X........"), 4) == board("X...O....")


def test_status_reports_a_won_board() -> None:
    assert status(board("XXXOO....")) == ("won", "X", (0, 1, 2))


def test_status_reports_a_drawn_board() -> None:
    assert status(board("XXOOOXXOX")) == ("drawn", None, None)


def test_status_reports_a_game_in_progress() -> None:
    assert status(board("X...O....")) == ("in_progress", None, None)
