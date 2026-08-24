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
    """A board submitted for analysis."""

    board: Annotated[list[CellValue], Field(min_length=9, max_length=9)]

    @field_validator("board")
    @classmethod
    def check_reachable(cls, board: list[CellValue]) -> list[CellValue]:
        """Reject boards that no real game could have produced.

        Args:
            board: The nine submitted cells.

        Returns:
            The board unchanged, if it is reachable.

        Raises:
            ValueError: If the move counts are impossible or both players
                hold a completed line.
        """
        exes = board.count("X")
        ohs = board.count("O")
        if exes not in (ohs, ohs + 1):
            raise ValueError(
                f"Unreachable board: {exes} X and {ohs} O. X moves first, so the number of X "
                "must equal the number of O or exceed it by exactly one."
            )
        if len(winning_marks(tuple(board))) > 1:
            raise ValueError("Unreachable board: both players hold a completed line.")
        return board


class MoveAnalysis(BaseModel):
    """One legal move's verdict and name."""

    index: int
    outcome: Literal["win", "draw", "loss"]
    distance: int
    rule: RuleName
    best: bool


class AnalyseResponse(BaseModel):
    """The full analysis of a submitted board."""

    status: Literal["in_progress", "won", "drawn"]
    player: Literal["X", "O"] | None
    winner: Literal["X", "O"] | None
    winning_line: list[int] | None
    moves: list[MoveAnalysis]
