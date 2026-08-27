from typing import Annotated, Literal

from pydantic import BaseModel, Field, field_validator

from game import winning_marks

CellValue = Literal["X", "O"] | None

RuleName = Literal[
    "win",
    "block",
    "fork",
    "block_fork",
    "centre",
    "opposite_corner",
    "empty_corner",
    "empty_side",
]


class AnalyseRequest(BaseModel):
    """A board submitted for analysis, optionally asking what a given opponent would play."""

    board: Annotated[list[CellValue], Field(min_length=9, max_length=9)]
    opponent: Literal["perfect", "fallible"] | None = None

    @field_validator("board")
    @classmethod
    def check_reachable(cls, board: list[CellValue]) -> list[CellValue]:
        """Reject boards that no real game could have produced.

        Three checks, which between them catch every unreachable board this API
        has any reason to worry about: the move counts, both players holding a
        line, and play continuing after someone has already won.

        Not caught: one player holding two completed lines that share no cell,
        which needs an earlier line to have gone unnoticed. It is nonsense the
        solver handles without complaint, and the check costs more than the
        input is worth.

        Args:
            board: The nine submitted cells.

        Returns:
            The board unchanged, if it is reachable.

        Raises:
            ValueError: If the move counts are impossible, both players hold a
                completed line, or the counts show play continued past a win.
        """
        exes = board.count("X")
        ohs = board.count("O")
        if exes not in (ohs, ohs + 1):
            raise ValueError(
                f"Unreachable board: {exes} X and {ohs} O. X moves first, so the number of X "
                "must equal the number of O or exceed it by exactly one."
            )
        won = winning_marks(tuple(board))
        if len(won) > 1:
            raise ValueError("Unreachable board: both players hold a completed line.")
        if won:
            # A game stops the moment a line completes, so the winner made the
            # last move: X wins one mark ahead, O wins level.
            winner = next(iter(won))
            if exes != (ohs + 1 if winner == "X" else ohs):
                raise ValueError(
                    f"Unreachable board: {winner} holds a completed line, so the game ended "
                    f"on that move — but {exes} X and {ohs} O show play carried on."
                )
        return board


class MoveAnalysis(BaseModel):
    """One legal move's verdict and name."""

    index: int
    outcome: Literal["win", "draw", "loss"]
    distance: int
    rule: RuleName
    best: bool


class AnalyseResponse(BaseModel):
    """The full analysis of a submitted board, and the computer's move if one was asked for."""

    status: Literal["in_progress", "won", "drawn"]
    player: Literal["X", "O"] | None
    winner: Literal["X", "O"] | None
    winning_line: list[int] | None
    moves: list[MoveAnalysis]
    suggested: int | None = None
