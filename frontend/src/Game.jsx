import { useEffect, useState } from 'react';
import Board from './Board.jsx';
import TeachingPanel, { TeachingDial } from './TeachingPanel.jsx';
import { useAnalysis } from './useAnalysis.js';
import {
  calculateWinner,
  isDraw,
  isOver,
  nextPlayer,
  playedCount,
} from './game.js';

const EMPTY_BOARD = Array(9).fill(null);

/** What the mode line calls each opponent. */
const OPPONENT_LABELS = {
  hotseat: 'Hotseat',
  fallible: 'vs Computer — fallible',
  perfect: 'vs Computer — perfect',
};

/** How long the computer appears to think, so its move reads as a move. */
const THINKING_MS = 400;

function Game({ settings, onChange, onQuit }) {
  const [squares, setSquares] = useState(EMPTY_BOARD);
  // Which cell was played last cannot be derived from `squares` — the board
  // records marks, not their order — so unlike the values below it is stored.
  const [lastMove, setLastMove] = useState(null);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  // Locked when the game starts. See `toggleWhoStarts` for why this is state
  // rather than a value derived from settings.computerFirst.
  const [humanMark, setHumanMark] = useState(
    settings.computerFirst ? 'O' : 'X',
  );

  const winner = calculateWinner(squares);
  const over = isOver(squares);
  const player = nextPlayer(squares);
  const played = playedCount(squares);

  const vsComputer = settings.opponent !== 'hotseat';
  const isComputerTurn = vsComputer && !over && player !== humanMark;
  const teachingOn = settings.teaching !== 'off';

  const { data, loading, error, retry } = useAnalysis(
    squares,
    isComputerTurn ? settings.opponent : null,
    teachingOn || isComputerTurn,
  );

  function playAt(index) {
    if (squares[index] !== null || over) {
      return;
    }
    const next = squares.slice();
    next[index] = player;
    setSquares(next);
    setLastMove(index);
  }

  // The board's click handler, as opposed to `playAt`, which the computer's
  // effect also calls. A cell is aria-disabled during the computer's turn but
  // that does not stop a click, so the turn is enforced here.
  function handleCellClick(index) {
    if (isComputerTurn) {
      return;
    }
    playAt(index);
  }

  useEffect(() => {
    if (!isComputerTurn || data?.suggested == null) {
      return undefined;
    }
    const timer = setTimeout(() => playAt(data.suggested), THINKING_MS);
    return () => clearTimeout(timer);
    // `playAt` is deliberately omitted. Omitting it is safe because any change
    // to `squares` re-runs useAnalysis's effect (board is in its deps), which
    // sets `data` to null and so tears this timer down first; and any `data`
    // predating an isComputerTurn flip was fetched without `opponent`, so its
    // `suggested` is null and this effect returns above. If either property
    // stops holding, this timer can play a move computed from a stale board.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [isComputerTurn, data]);

  function startNewGame() {
    // A fresh array, not the EMPTY_BOARD constant: identity is what
    // re-triggers useAnalysis's fetch (and re-rolls a perfect opponent's
    // random opening), and setState bails out on an identical reference.
    setSquares(Array(9).fill(null));
    setLastMove(null);
    setHoveredIndex(null);
    setHumanMark(settings.computerFirst ? 'O' : 'X');
  }

  function toggleWhoStarts() {
    const computerFirst = !settings.computerFirst;
    onChange((previous) => ({ ...previous, computerFirst }));
    // Only while the board is empty. Flipping this mid-game would otherwise
    // make it the computer's turn immediately and let it steal a move.
    if (played === 0) {
      setHumanMark(computerFirst ? 'O' : 'X');
    }
  }

  let status;
  if (winner) {
    status = vsComputer
      ? winner.player === humanMark
        ? 'You win!'
        : 'The computer wins.'
      : `${winner.player} wins!`;
  } else if (isDraw(squares)) {
    status = vsComputer ? 'Draw — the best there is.' : 'Draw';
  } else if (vsComputer) {
    status = isComputerTurn
      ? error
        ? 'Waiting for the server…'
        : 'Computer thinking…'
      : `Your turn — you are ${humanMark}`;
  } else {
    status = `${player} to play`;
  }

  return (
    <div className="text-center">
      <h1 className="mb-1">TicTacTooGood</h1>
      <p className="text-body-secondary small mb-3">
        {OPPONENT_LABELS[settings.opponent]}
      </p>
      <p className="fs-4 mb-4" aria-live="polite">
        {status}
      </p>

      {error && (
        <div className="alert alert-warning" role="alert">
          <p className="mb-2">Analysis unavailable: {error}</p>
          <button
            type="button"
            className="btn btn-sm btn-warning"
            onClick={retry}
          >
            Retry
          </button>
        </div>
      )}

      <div className="d-flex justify-content-center">
        <TeachingDial
          value={settings.teaching}
          onChange={(teaching) =>
            onChange((previous) => ({ ...previous, teaching }))
          }
        />
      </div>

      {/* Three fixed columns, always the same shape. The side columns are equal
          width, so the board sits dead centre whether or not the panel has
          anything to say, and Phase 3's move history drops into the left one
          without shifting the board. */}
      <div className="row g-4 align-items-start">
        <div className="col-lg-3 d-none d-lg-block" aria-hidden="true" />
        <div className="col-lg-6">
          <Board
            squares={squares}
            winningLine={winner?.line}
            lastMove={lastMove}
            disabled={over || isComputerTurn}
            onPlay={handleCellClick}
            moves={isComputerTurn ? null : data?.moves}
            teaching={settings.teaching}
            hoveredIndex={hoveredIndex}
            onHover={setHoveredIndex}
          />
        </div>
        <div className="col-lg-3">
          {/* Always rendered, so content fills a frame that was already on
              screen instead of a box appearing out of blank page. */}
          <div className="card h-100 text-start">
            <div className="card-body">
              {!teachingOn ? (
                <p className="text-body-secondary small mb-0">
                  Teaching is off. Choose <strong>Best move</strong> or{' '}
                  <strong>Every move</strong> above to see what the engine makes
                  of this position.
                </p>
              ) : isComputerTurn ? (
                <p className="text-body-secondary mb-0" aria-live="polite">
                  Thinking…
                </p>
              ) : (
                <TeachingPanel
                  analysis={data}
                  loading={loading}
                  error={error}
                  teaching={settings.teaching}
                  hoveredIndex={hoveredIndex}
                  onHover={setHoveredIndex}
                  vsComputer={vsComputer}
                  humanMark={humanMark}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {vsComputer && (
        <div className="mt-4">
          <div className="form-check form-switch d-inline-flex align-items-center gap-2">
            <input
              className="form-check-input"
              type="checkbox"
              role="switch"
              id="computer-first"
              checked={settings.computerFirst}
              onChange={toggleWhoStarts}
            />
            <label className="form-check-label" htmlFor="computer-first">
              Computer goes first
            </label>
          </div>
          {played > 0 && (
            <p className="text-body-secondary small mb-0">
              Changes apply to the next game.
            </p>
          )}
        </div>
      )}

      <div className="mt-4 d-flex gap-2 justify-content-center">
        <button
          type="button"
          className="btn btn-primary"
          onClick={startNewGame}
        >
          New Game
        </button>
        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={onQuit}
        >
          Back to menu
        </button>
      </div>
    </div>
  );
}

export default Game;
