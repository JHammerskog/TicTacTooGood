const WINNING_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

/**
 * Finds the winner of a tic-tac-toe board, if there is one.
 *
 * @param {Array<'X' | 'O' | null>} squares - 9 cells, left-to-right then
 *   top-to-bottom.
 * @returns {{ player: 'X' | 'O', line: number[] } | null} The winner and the
 *   three indices that won, ordered from one end of the line to the other,
 *   or null if nobody has won. The line is returned because the UI draws
 *   across it.
 */
export function calculateWinner(squares) {
  for (const line of WINNING_LINES) {
    const [a, b, c] = line;
    if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
      return { player: squares[a], line };
    }
  }
  return null;
}

/**
 * Counts the squares already played.
 *
 * @param {Array<'X' | 'O' | null>} squares - 9 cells.
 * @returns {number} How many cells hold a mark.
 */
export function playedCount(squares) {
  return squares.filter((square) => square !== null).length;
}

/**
 * Whose turn it is. X moves first, so the parity of the moves played
 * decides it — the board records marks, not their order, but it does not
 * need to.
 *
 * @param {Array<'X' | 'O' | null>} squares - 9 cells.
 * @returns {'X' | 'O'} The player to move.
 */
export function nextPlayer(squares) {
  return playedCount(squares) % 2 === 0 ? 'X' : 'O';
}

/**
 * Whether the game ended with no winner.
 *
 * @param {Array<'X' | 'O' | null>} squares - 9 cells.
 * @returns {boolean} True when the board is full and nobody won.
 */
export function isDraw(squares) {
  return !calculateWinner(squares) && playedCount(squares) === squares.length;
}

/**
 * Whether the game has finished, either way.
 *
 * @param {Array<'X' | 'O' | null>} squares - 9 cells.
 * @returns {boolean} True when the game is won or drawn.
 */
export function isOver(squares) {
  return Boolean(calculateWinner(squares)) || isDraw(squares);
}

/** Rotates a 3x3 grid's index labels a quarter turn clockwise. */
const rotate = (indices) => [6, 3, 0, 7, 4, 1, 8, 5, 2].map((i) => indices[i]);

/** Mirrors a 3x3 grid's index labels left to right. */
const mirror = (indices) => [2, 1, 0, 5, 4, 3, 8, 7, 6].map((i) => indices[i]);

/**
 * The square's eight symmetries, as index permutations: four rotations, each
 * also mirrored. Applying one to a board gives the same position seen from a
 * different angle.
 */
export const SYMMETRIES = (() => {
  const all = [];
  let indices = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  for (let turn = 0; turn < 4; turn += 1) {
    all.push(indices);
    all.push(mirror(indices));
    indices = rotate(indices);
  }
  return all;
})();

/**
 * A key identifying a position's shape rather than its exact cells.
 *
 * Two boards that are rotations or reflections of one another share a key, so a
 * trap the player met turned on its side still matches the taught one. The
 * marks are compared as they are: the tutorials' trapped player is always O, so
 * a real game's trap carries the same marks as the taught position.
 *
 * @param {Array<'X' | 'O' | null>} board - 9 cells.
 * @returns {string} The smallest of the board's eight renderings, with '.' for
 *   an empty cell — for example '..O.X.X..'.
 */
export function positionKey(board) {
  const marks = board.map((cell) => cell ?? '.');
  return SYMMETRIES.map((permutation) =>
    permutation.map((index) => marks[index]).join(''),
  ).sort()[0];
}

/**
 * The other mark. The backend calls this `game.opponent`; the word is avoided
 * here because "opponent" already names a difficulty setting in this app.
 *
 * @param {'X' | 'O'} mark - Either mark.
 * @returns {'X' | 'O'} The other one.
 */
export const other = (mark) => (mark === 'X' ? 'O' : 'X');

/**
 * How long a computer or scripted opponent appears to think, so its move reads
 * as a move rather than as the board changing under the player's hand. Shared
 * so the game and the tutorial exercise feel like the same opponent.
 */
export const THINKING_MS = 400;

/** Human names for the nine cells, in board order. */
export const CELL_NAMES = [
  'top left',
  'top centre',
  'top right',
  'middle left',
  'centre',
  'middle right',
  'bottom left',
  'bottom centre',
  'bottom right',
];

/**
 * Plain-English wording for each rule the API can return. The keys are the
 * `rule` values from `POST /api/analyse`; a missing key means the backend
 * grew a rule the frontend has not been taught.
 */
export const RULE_TEXT = {
  win: 'wins outright',
  block: 'blocks their win',
  fork: 'creates a fork',
  block_fork: 'stops their fork',
  centre: 'takes the centre',
  opposite_corner: 'takes the opposite corner',
  empty_corner: 'takes a corner',
  empty_side: 'takes a side',
};

/**
 * Filters the moves the API returned down to what the current teaching
 * level should show. In "Best move" mode only the optimal moves are
 * shown, so the rest of the position stays unspoiled; "Every move" shows
 * everything. "Off" shows nothing: an analysis is fetched whenever
 * teaching, critique, or the computer needs one, so a player who turned
 * teaching off can still have a live analysis in hand — and must not be
 * shown it.
 *
 * @param {Array<object> | null | undefined} moves - Moves from the API's
 *   `analyse` response, or a nullish value while analysis is unavailable.
 * @param {'off' | 'hints' | 'full'} teaching - The current teaching level.
 * @returns {Array<object>} The moves to display, possibly empty.
 */
export function visibleMoves(moves, teaching) {
  if (teaching === 'off') {
    return [];
  }
  return (moves ?? []).filter((move) => teaching === 'full' || move.best);
}

/**
 * Renders an outcome and distance as English.
 *
 * @param {'win' | 'draw' | 'loss'} outcome - From the mover's perspective.
 * @param {number} distance - Plies remaining after the move is played.
 * @returns {string} Wording such as "wins in 3". Draws carry no number:
 *   how long a drawn game runs is not something a player should optimise.
 */
export function describeOutcome(outcome, distance) {
  if (outcome === 'draw') {
    return 'draws';
  }
  const verb = outcome === 'win' ? 'wins' : 'loses';
  return distance === 0 ? `${verb} now` : `${verb} in ${distance}`;
}

/**
 * Whether every legal move is equally good, so singling one out says nothing.
 *
 * True on an empty board, where all nine moves draw, and in any later position
 * where the engine rates every remaining move identically — including a lost
 * one where they all lose the same way. Because `best` means optimal on both
 * outcome and distance, every move in such a position shares one verdict.
 *
 * @param {Array<{best: boolean}> | null | undefined} moves - Legal moves.
 * @returns {boolean} True when no move is better than another.
 */
export function allMovesTied(moves) {
  return (
    Array.isArray(moves) && moves.length > 0 && moves.every((move) => move.best)
  );
}

/**
 * What to say when every legal move is tied, keyed by the verdict they share.
 *
 * The three cases are genuinely different situations: a level position invites
 * a free choice, a won one cannot be spoiled, and a lost one offers nothing at
 * all — and saying "play whichever you like" into a forced loss reads as the
 * app not understanding its own analysis.
 */
export const TIED_MESSAGE = {
  draw: {
    heading: 'Nothing to choose',
    body: 'Play whichever you like — the position decides nothing yet.',
  },
  win: {
    heading: 'You cannot miss',
    body: 'Every square finishes it. Take your pick and enjoy it.',
  },
  loss: {
    heading: 'Nothing left to do',
    body:
      'Nothing to work out and nothing to save — just choose a square to ' +
      'lose on. They are all equally bad :(',
  },
};

/**
 * How a finished game is described in the teaching panel.
 *
 * Against a computer the marks are the wrong vocabulary — which of X or O you
 * are depends on the who-goes-first toggle, so "X won" makes the reader work
 * out whether that was them. Naming the player instead removes that step. In
 * hotseat both players are human, so the mark IS the identity.
 *
 * @param {'X' | 'O' | null} winnerMark - The winner, or null for a draw.
 * @param {boolean} vsComputer - Whether one side is the computer.
 * @param {'X' | 'O' | null} humanMark - The mark the human is playing, or
 *   null in hotseat, where both players are human and it means nothing.
 * @returns {string} A short sentence naming the result.
 */
export function describeResult(winnerMark, vsComputer, humanMark) {
  if (!winnerMark) {
    return 'Drawn.';
  }
  if (!vsComputer) {
    return `${winnerMark} won!`;
  }
  return winnerMark === humanMark ? 'Human won!' : 'Computer won.';
}

/**
 * Plays a move, returning the new history and cursor.
 *
 * Playing from a position you have navigated back to discards everything after
 * it: the game continues from there rather than branching. That is one
 * expression rather than three behaviours — it is also what disables Forward
 * and empties the visible move list.
 *
 * @param {Array<Array<'X' | 'O' | null>>} history - Every position so far.
 * @param {number} cursor - Which position is on screen.
 * @param {number} index - The cell to play.
 * @param {'X' | 'O'} mark - Whose move it is.
 * @returns {{ history: Array<Array<'X' | 'O' | null>>, cursor: number }} The
 *   new state, or the arguments unchanged if the cell is already occupied.
 */
export function playInHistory(history, cursor, index, mark) {
  const board = history[cursor];
  if (board[index] !== null) {
    return { history, cursor };
  }
  const next = board.slice();
  next[index] = mark;
  return {
    history: [...history.slice(0, cursor + 1), next],
    cursor: cursor + 1,
  };
}

/**
 * Finds the cell that changed between two consecutive positions.
 *
 * This replaces the `lastMove` state Phase 1 had to store: with a history the
 * answer is derivable, so the highlight follows the cursor while navigating
 * instead of being stuck on the most recent move played.
 *
 * @param {Array<'X' | 'O' | null> | undefined} previous - The position before.
 * @param {Array<'X' | 'O' | null> | undefined} current - The position now.
 * @returns {number | null} The changed cell, or null at the start of a game.
 */
export function lastMoveIndex(previous, current) {
  if (!previous || !current) {
    return null;
  }
  for (let index = 0; index < current.length; index += 1) {
    if (previous[index] !== current[index]) {
      return index;
    }
  }
  return null;
}

/**
 * Names each position in a history, for the move list.
 *
 * @param {Array<Array<'X' | 'O' | null>>} history - Every position so far.
 * @returns {string[]} One label per position: "Game start", then
 *   "1. X centre" and so on, numbered by ply.
 */
export function moveLabels(history) {
  return history.map((board, ply) => {
    if (ply === 0) {
      return 'Game start';
    }
    const index = lastMoveIndex(history[ply - 1], board);
    return `${ply}. ${board[index]} ${CELL_NAMES[index]}`;
  });
}

/** Outcomes ordered worst to best, for comparing what you got against what
 *  was available. */
const OUTCOME_RANK = { loss: 0, draw: 1, win: 2 };

/**
 * Decides whether a move threw something away.
 *
 * Only a change of outcome counts: draw to loss, or win to draw. Winning more
 * slowly is not an error, and neither is a non-optimal move that still draws —
 * flagging those would teach the player to ignore the warnings.
 *
 * Every optimal move shares one outcome, so the first is representative.
 *
 * @param {{ moves: Array<object> } | null} analysis - The analysis of the
 *   position the move was played in, or null if none had arrived.
 * @param {number} index - The cell that was played.
 * @returns {{ played: object, bestOutcome: string, alternatives: Array<object> }
 *   | null} The verdict, or null when the move cost nothing or cannot be judged.
 */
export function judgeMove(analysis, index) {
  const moves = analysis?.moves;
  if (!Array.isArray(moves) || moves.length === 0) {
    return null;
  }
  const played = moves.find((move) => move.index === index);
  const alternatives = moves.filter((move) => move.best);
  if (!played || alternatives.length === 0) {
    return null;
  }
  const bestOutcome = alternatives[0].outcome;
  if (OUTCOME_RANK[played.outcome] >= OUTCOME_RANK[bestOutcome]) {
    return null;
  }
  return { played, bestOutcome, alternatives };
}

/**
 * Every empty square that would win the game immediately for `mark`.
 *
 * A fork leaves two of them, which is why this returns a list rather than a
 * single square: after the tutorials' punish there is no one right answer.
 *
 * @param {Array<'X' | 'O' | null>} board - The position to look at.
 * @param {'X' | 'O'} mark - The player looking for a win.
 * @returns {number[]} Cell indices, ascending. Empty if nothing wins yet.
 */
export function winningSquares(board, mark) {
  const wins = [];
  for (let index = 0; index < board.length; index += 1) {
    if (board[index] !== null) {
      continue;
    }
    const trial = board.slice();
    trial[index] = mark;
    if (calculateWinner(trial)?.player === mark) {
      wins.push(index);
    }
  }
  return wins;
}
