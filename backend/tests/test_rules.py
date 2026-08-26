from conftest import board

from game import legal_moves
from rules import name_move


def test_completing_a_line_is_a_win() -> None:
    # X to play; 2 completes the top row.
    assert name_move(board("XX.OO...."), 2) == "win"


def test_denying_an_opponent_line_is_a_block() -> None:
    # O to play; X threatens 2, so 2 is a block.
    assert name_move(board("XX.O....."), 2) == "block"


def test_winning_outranks_blocking() -> None:
    # Cell 2 is genuinely BOTH: X to play completes X's row (0, 1, 2), and O
    # playing there would complete O's line (2, 4, 6). Both predicates are
    # independently true, so this actually exercises the priority order —
    # a fixture where only one is true would pass whatever the order was.
    assert name_move(board("XX..O.O.."), 2) == "win"


def test_creating_two_threats_is_a_fork() -> None:
    # X holds the bottom corners 6 and 8, O holds the sides 5 and 7, X to
    # play. Taking corner 0 opens both (0, 3, 6) and (0, 4, 8) — two winning
    # replies, and O cannot block both.
    assert name_move(board(".....OXOX"), 0) == "fork"


def test_a_move_that_removes_the_fork_threat_is_a_block_fork() -> None:
    # X holds the bottom corners 6 and 8, O holds 7, O to play. X forks unless
    # O takes the centre, and the centre is the ONLY move that removes the
    # threat. It also proves block_fork outranks centre in the priority order.
    assert name_move(board("......XOX"), 4) == "block_fork"


def test_the_middle_cell_is_the_centre() -> None:
    assert name_move(board("........."), 4) == "centre"


def test_a_corner_diagonally_opposite_the_opponent_is_the_opposite_corner() -> None:
    # X to play; O holds corner 0, so corner 8 is the opposite corner.
    assert name_move(board("OX......."), 8) == "opposite_corner"


def test_a_free_corner_with_no_opponent_opposite_is_an_empty_corner() -> None:
    # X to play (1 X, 1 O already placed, so counts are even). O holds corner
    # 2, which is NOT opposite corner 0 (that's 8, still empty) — this proves
    # the check looks at the opposite corner specifically, not "any opponent
    # mark exists anywhere", which an all-empty board could never tell apart.
    assert name_move(board("..O..X..."), 0) == "empty_corner"


def test_an_edge_cell_is_an_empty_side() -> None:
    assert name_move(board("........."), 1) == "empty_side"


def test_every_legal_move_on_an_empty_board_gets_a_name() -> None:
    """centre, the four corners and the four sides cover all nine cells, so
    no legal move is ever nameless."""
    empty = board(".........")
    names = [name_move(empty, index) for index in legal_moves(empty)]
    assert len(names) == 9
    assert set(names) == {"centre", "empty_corner", "empty_side"}
