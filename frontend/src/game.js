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
