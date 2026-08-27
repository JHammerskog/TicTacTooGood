import { useEffect, useState } from 'react';
import Board from './Board.jsx';
import ComputerControl from './ComputerControl.jsx';
import CritiqueSwitch from './CritiqueSwitch.jsx';
import MoveList from './MoveList.jsx';
import TeachingPanel from './TeachingPanel.jsx';
import TeachingDial from './TeachingDial.jsx';
import { playPencil } from './sound.js';
import { useAnalysis } from './useAnalysis.js';
import { useGameHistory } from './useGameHistory.js';
import {
  calculateWinner,
  CELL_NAMES,
  isDraw,
  isOver,
  judgeMove,
  lastMoveIndex,
  moveLabels,
  nextPlayer,
  other,
  RULE_TEXT,
  THINKING_MS,
} from './game.js';

function Game({ settings, onChange, onQuit, muted }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [showMoves, setShowMoves] = useState(false);
  const [critique, setCritique] = useState(null);
  // One entry per human move, so the post-game review needs no refetching.
  // `judged` distinguishes "we looked and it was fine" from "no analysis had
  // arrived" — a move played faster than the network must not be reported as
  // correct.
  const [records, setRecords] = useState([]);

  function scratch() {
    if (!muted) {
      playPencil();
    }
  }

  const {
    history,
    cursor,
    squares,
    lastMove,
    atTip,
    replaying,
    playAt: playInGame,
    goTo: goToPly,
    reset: resetHistory,
  } = useGameHistory(scratch);
  // "Settled and live": the position on screen is the real one, and nothing is
  // mid-flight. The computer may only move in this state. A critique does NOT
  // hold it — a warning is something to read, not a dialog to dismiss, so play
  // continues underneath it and the banner carries the ply it is about so its
  // take-back stays correct however many moves land on top.
  const live = atTip && !replaying;

  const winner = calculateWinner(squares);
  const over = isOver(squares);
  const player = nextPlayer(squares);

  // Both derived from one setting rather than tracked separately. The mark the
  // computer holds decides everything: whether there is a computer at all,
  // which side the player is, and — by comparing it with the side to move —
  // whether the computer answers now or waits. That is what makes switching it
  // on mid-game well defined.
  const vsComputer = settings.computerMark !== null;
  // null in hotseat, where both players are human and neither owns the
  // question. `other(null)` answered 'X', which every reader below happens
  // to sit behind a `vsComputer` check — a wrong value waiting for the first
  // caller that forgets.
  const humanMark = vsComputer ? other(settings.computerMark) : null;
  const isComputerTurn =
    vsComputer && !over && player === settings.computerMark;
  const teachingOn = settings.teaching !== 'off';

  const { data, loading, error, retry } = useAnalysis(
    squares,
    isComputerTurn ? settings.difficulty : null,
    // `over` is in here because the end-of-game review needs the analysis even
    // when every teaching setting is off: it reads the result from it.
    // `!replaying` suppresses the requests for positions a jump only passes
    // through: they are never rendered, and each one was fired and aborted a
    // frame later. The destination position fetches normally, because
    // `replaying` is false again once the cursor arrives.
    (teachingOn || settings.critique || isComputerTurn || over) && !replaying,
  );

  // Guard against the one frame where `data` still describes the previous
  // position: it is cleared by an effect, which runs after the commit that
  // already painted the new board.
  const analysis = data && data.board === squares ? data : null;

  function playAt(index) {
    if (over) {
      return;
    }
    playInGame(index, player);
  }

  // Every navigation goes through here so there is exactly one path, and so a
  // critique banner cannot outlive the move it describes: stepping away from
  // that move dismisses its warning rather than leaving it pointing at a
  // position no longer on screen.
  function goTo(ply) {
    setCritique(null);
    goToPly(ply);
  }

  // The board's click handler, as opposed to `playAt`, which the computer's
  // effect also calls. Only reachable for a legal click: `Board` refuses an
  // occupied cell and anything the `disabled` prop below covers, which is why
  // this records and judges before delegating without re-checking first.
  //
  // What `disabled` covers, and why: the game being over; a replay in flight,
  // where an accepted click would branch the history mid-walk and destroy the
  // moves being reviewed; and the computer's turn AT THE TIP, where taking its
  // move would be stealing it. Away from the tip you are branching a new line,
  // and being locked out of half the positions in the game — every other ply —
  // for no reason you can see is worse than letting you play both sides of a
  // line you are exploring. The computer picks the line up from the new tip.
  function handleCellClick(index) {
    const mistake = judgeMove(analysis, index);
    setRecords((previous) => [
      ...previous.filter((record) => record.ply < cursor + 1),
      { ply: cursor + 1, judged: analysis !== null, mistake },
    ]);
    // Set on every move, not only on a bad one: a clean move clears whatever
    // warning the last one raised, which is what makes the banner go away by
    // playing on rather than by pressing a button.
    setCritique(
      settings.critique && mistake ? { ...mistake, ply: cursor + 1 } : null,
    );
    playAt(index);
  }

  useEffect(() => {
    if (!isComputerTurn || !live || analysis?.suggested == null) {
      return undefined;
    }
    const timer = setTimeout(() => playAt(analysis.suggested), THINKING_MS);
    return () => clearTimeout(timer);
    // `playAt` is deliberately omitted. Omitting it is safe because any change
    // to `squares` re-runs useAnalysis's effect (board is in its deps), which
    // sets `data` to null and so tears this timer down first; and any `data`
    // predating an isComputerTurn flip was fetched without `opponent`, so its
    // `suggested` is null and this effect returns above. If either property
    // stops holding, this timer can play a move computed from a stale board.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [isComputerTurn, live, analysis]);

  function startNewGame() {
    resetHistory();
    setHoveredIndex(null);
    setCritique(null);
    setRecords([]);
  }

  let status;
  if (!atTip) {
    status =
      cursor === 0
        ? 'Reviewing the start of the game'
        : `Reviewing move ${cursor} of ${history.length - 1}`;
  } else if (winner) {
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
        {vsComputer
          ? `vs Computer — ${settings.difficulty} · you are ${humanMark}`
          : 'Hotseat'}
      </p>
      <p className="fs-4 mb-4" aria-live="polite">
        {status}
      </p>

      <div className="d-flex flex-wrap justify-content-center align-items-start gap-4 mb-3">
        <TeachingDial
          value={settings.teaching}
          onChange={(teaching) =>
            onChange((previous) => ({ ...previous, teaching }))
          }
        />
        <ComputerControl
          value={settings.computerMark}
          onChange={(computerMark) =>
            onChange((previous) => ({ ...previous, computerMark }))
          }
        />
        <CritiqueSwitch
          value={settings.critique}
          onChange={(critique) => {
            if (!critique) {
              setCritique(null);
            }
            onChange((previous) => ({ ...previous, critique }));
          }}
        />
      </div>

      {/* One slot for every transient message, holding its height whether or
          not anything is in it. Messages used to render inline in two separate
          places, so each one appearing shoved the board down the page. Error
          wins over critique because a critique is derived from an analysis that
          arrived: the two cannot describe the same move. */}
      <div className="message-slot mx-auto">
        {error ? (
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
        ) : critique ? (
          <div className="alert alert-warning text-start" role="alert">
            <p className="mb-2">
              That{' '}
              {critique.played.outcome === 'loss'
                ? 'loses the game'
                : 'gives up the win'}
              .{' '}
              {critique.alternatives.length === 1
                ? `${CELL_NAMES[critique.alternatives[0].index]} was the move — ${RULE_TEXT[critique.alternatives[0].rule] ?? critique.alternatives[0].rule}.`
                : `${critique.alternatives.length} other squares held the ${critique.bestOutcome}.`}
            </p>
            <button
              type="button"
              className="btn btn-sm btn-warning"
              onClick={() => goTo(critique.ply - 1)}
            >
              Take it back
            </button>
          </div>
        ) : null}
      </div>

      {/* Three fixed columns, always the same shape. The side columns are equal
          width, so the board sits dead centre whether or not the panel has
          anything to say, and Phase 3's move history drops into the left one
          without shifting the board. */}
      <div className="row g-4 align-items-start">
        <div className="col-lg-3">
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm mb-2"
            aria-expanded={showMoves}
            onClick={() => setShowMoves((shown) => !shown)}
          >
            {showMoves ? 'Hide moves' : `Moves (${history.length - 1})`}
          </button>
          {showMoves && (
            <MoveList
              labels={moveLabels(history)}
              cursor={cursor}
              onJump={goTo}
            />
          )}
        </div>
        <div className="col-lg-6">
          <Board
            squares={squares}
            winningLine={winner?.line}
            lastMove={lastMove}
            disabled={over || replaying || (atTip && isComputerTurn)}
            onPlay={handleCellClick}
            moves={isComputerTurn ? null : analysis?.moves}
            teaching={settings.teaching}
            hoveredIndex={hoveredIndex}
            onHover={setHoveredIndex}
          />
          <div className="d-flex justify-content-center gap-2 mt-3">
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={() => goTo(cursor - 1)}
              disabled={cursor === 0 || replaying}
            >
              ← Back
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={() => goTo(cursor + 1)}
              disabled={atTip || replaying}
            >
              Forward →
            </button>
          </div>
        </div>
        <div className="col-lg-3">
          {/* Always rendered, so content fills a frame that was already on
              screen instead of a box appearing out of blank page. */}
          <div className="card h-100 text-start">
            <div className="card-body">
              {!teachingOn && !over ? (
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
                  analysis={analysis}
                  loading={loading}
                  error={error}
                  teaching={settings.teaching}
                  hoveredIndex={hoveredIndex}
                  onHover={setHoveredIndex}
                  vsComputer={vsComputer}
                  humanMark={humanMark}
                  records={records.map((record) => {
                    const index = lastMoveIndex(
                      history[record.ply - 1],
                      history[record.ply],
                    );
                    return {
                      ...record,
                      index,
                      mark: history[record.ply][index],
                    };
                  })}
                  onGoTo={goTo}
                />
              )}
            </div>
          </div>
        </div>
      </div>

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
