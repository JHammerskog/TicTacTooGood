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
 * everything.
 *
 * @param {Array<object> | null | undefined} moves - Moves from the API's
 *   `analyse` response, or a nullish value while analysis is unavailable.
 * @param {'off' | 'hints' | 'full'} teaching - The current teaching level.
 * @returns {Array<object>} The moves to display, possibly empty.
 */
export function visibleMoves(moves, teaching) {
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
 * @param {'X' | 'O'} humanMark - The mark the human is playing.
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
