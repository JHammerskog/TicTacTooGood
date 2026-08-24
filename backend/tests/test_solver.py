from conftest import board

from game import legal_moves, play, winner
from solver import analyse_moves, evaluate


def test_perfect_play_from_an_empty_board_is_a_draw() -> None:
    """Tic-tac-toe is a solved draw. Self-play is the strongest single check
    on the search: a wrong perspective, a sign error, or mishandled distance
    all break this."""
    position = board(".........")
    while legal_moves(position):
        best = next(move for move in analyse_moves(position) if move.best)
        position = play(position, best.index)
        if winner(position) is not None:
            break
    assert winner(position) is None
    assert legal_moves(position) == ()


def test_every_opening_move_draws() -> None:
    """No first move wins or loses against perfect defence."""
    moves = analyse_moves(board("........."))
    assert len(moves) == 9
    assert {move.outcome for move in moves} == {"draw"}
    assert all(move.best for move in moves)


def test_a_winning_move_is_reported_as_a_win_at_distance_zero() -> None:
    # X to play; 2 completes the top row.
    moves = {move.index: move for move in analyse_moves(board("XX.OO...."))}
    assert moves[2].outcome == "win"
    assert moves[2].distance == 0
    assert moves[2].best is True


def test_the_only_saving_move_is_the_one_marked_best() -> None:
    # O to play and X threatens 2 to complete the top row. O must block there.
    moves = {move.index: move for move in analyse_moves(board("XX.O....."))}
    assert moves[2].best is True
    assert [index for index, move in moves.items() if move.best] == [2]


def test_evaluate_scores_a_lost_position_for_the_player_to_move() -> None:
    # X has already won; O is nominally to move and has lost.
    score, distance = evaluate(board("XXXOO...."))
    assert score == -1
    assert distance == 0


def test_evaluate_scores_a_full_drawn_board_as_a_draw() -> None:
    score, distance = evaluate(board("XXOOOXXOX"))
    assert score == 0
    assert distance == 0


def test_a_winning_fork_is_recognised_as_the_best_move() -> None:
    """A real tactic the search must find: X forks at corner 0, opening both
    (0, 3, 6) and (0, 4, 8), and O cannot block both."""
    moves = {move.index: move for move in analyse_moves(board(".....OXOX"))}
    assert moves[0].outcome == "win"
    assert moves[0].best is True


def test_a_faster_win_is_preferred_over_a_slower_one() -> None:
    """Distance is what stops a winning engine dawdling.

    This fixture must have two moves that BOTH win at DIFFERENT distances,
    or the assertions pass trivially and the tie-break goes untested. X to
    play: 8 wins immediately, 4 also wins but two plies later.
    """
    moves = {move.index: move for move in analyse_moves(board("XOXO.X.O."))}
    assert moves[8].outcome == "win"
    assert moves[4].outcome == "win"
    assert moves[8].distance == 0
    assert moves[4].distance == 2
    assert moves[8].best is True
    assert moves[4].best is False


def test_a_slower_loss_is_preferred_over_a_faster_one() -> None:
    """The mirror of the rule above: when every move loses, the best move is
    the one that survives longest, because it gives the opponent more chances
    to err. O to play and lost whatever it does — five moves lose on the next
    ply, and only 8 holds out to three.
    """
    moves = {move.index: move for move in analyse_moves(board("XO..X...."))}
    assert {move.outcome for move in moves.values()} == {"loss"}
    assert moves[8].distance == 3
    assert moves[8].best is True
    assert [index for index, move in moves.items() if move.best] == [8]


def test_a_won_board_offers_no_moves() -> None:
    """The game is over: cells may be empty but none of them is playable."""
    assert analyse_moves(board("XXXOO....")) == []
