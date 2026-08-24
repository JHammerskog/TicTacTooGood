import { useState } from 'react';
import Board from './Board.jsx';
import { calculateWinner } from './game.js';

const EMPTY_BOARD = Array(9).fill(null);

function App() {
  const [squares, setSquares] = useState(EMPTY_BOARD);
  // Which cell was played last cannot be derived from `squares` — the board
  // records marks, not their order — so unlike the values below it is stored.
  const [lastMove, setLastMove] = useState(null);

  // ponytail: turn/draw derivation lives here rather than in game.js. Phase 2's
  // solver needs "whose turn" and "is it over" too — move `played`, `isDraw`,
  // `isOver` and `nextPlayer` into game.js when that work starts, where they
  // also become testable under the existing `node --test` for no new deps.
  const winner = calculateWinner(squares);
  const played = squares.filter((square) => square !== null).length;
  const isDraw = !winner && played === squares.length;
  const isOver = Boolean(winner) || isDraw;
  const nextPlayer = played % 2 === 0 ? 'X' : 'O';

  function handlePlay(index) {
    if (squares[index] || isOver) {
      return;
    }
    const next = squares.slice();
    next[index] = nextPlayer;
    setSquares(next);
    setLastMove(index);
  }

  function startNewGame() {
    setSquares(EMPTY_BOARD);
    setLastMove(null);
  }

  let status;
  if (winner) {
    status = `${winner.player} wins!`;
  } else if (isDraw) {
    status = 'Draw';
  } else {
    status = `${nextPlayer} to play`;
  }

  return (
    <main className="container py-5 text-center">
      <h1 className="mb-4">TicTacTooGood</h1>
      <p className="fs-4 mb-4" aria-live="polite">
        {status}
      </p>
      <Board
        squares={squares}
        winningLine={winner?.line}
        lastMove={lastMove}
        isOver={isOver}
        onPlay={handlePlay}
      />
      <button
        type="button"
        className="btn btn-primary mt-4"
        onClick={startNewGame}
      >
        New Game
      </button>
    </main>
  );
}

export default App;
