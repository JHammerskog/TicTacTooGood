import {
  CELL_NAMES,
  RULE_TEXT,
  TIED_MESSAGE,
  allMovesTied,
  describeResult,
  describeOutcome,
  visibleMoves,
} from './game.js';

function MoveRow({ move, hovered, onHover }) {
  // Stacked rather than side by side: the panel column is deliberately narrow
  // so the board stays centred, and a two-column row wraps "middle right" and
  // "takes the opposite corner" into an unreadable stack of fragments.
  return (
    <li
      className={`list-group-item${hovered ? ' list-group-item-primary' : ''}`}
      onMouseEnter={() => onHover(move.index)}
      onMouseLeave={() => onHover(null)}
    >
      <div>
        {move.best ? '★ ' : ''}
        {CELL_NAMES[move.index]}
      </div>
      <div className="text-body-secondary small">
        {RULE_TEXT[move.rule] ?? move.rule} —{' '}
        {describeOutcome(move.outcome, move.distance)}
      </div>
    </li>
  );
}

function TeachingPanel({
  analysis,
  loading,
  error,
  teaching,
  hoveredIndex,
  onHover,
  vsComputer,
  humanMark,
  records,
  onGoTo,
}) {
  // Game.jsx already renders the authoritative "Analysis unavailable" alert
  // above this panel, so on error the panel stays silent rather than also
  // showing a spinner that would never resolve.
  if (error) {
    return null;
  }

  if (loading || !analysis) {
    return (
      <p className="text-body-secondary" aria-live="polite">
        <span
          className="spinner-border spinner-border-sm me-2"
          aria-hidden="true"
        />
        Analysing…
      </p>
    );
  }

  if (analysis.status !== 'in_progress') {
    const slips = records.filter((record) => record.mistake);
    const unjudged = records.filter((record) => !record.judged).length;
    const checked = records.length - unjudged;
    return (
      <div className="text-start">
        <h2 className="fs-5">
          {describeResult(analysis.winner, vsComputer, humanMark)}
        </h2>
        {slips.length === 0 ? (
          unjudged === 0 ? (
            <p className="text-body-secondary mb-0">
              No mistakes. You played it out correctly.
            </p>
          ) : (
            // Nothing checked at all: the paragraph below already says so, and
            // "nothing flagged in the 0 moves I could check" is noise.
            checked > 0 && (
              <p className="text-body-secondary mb-0">
                Nothing flagged in the {checked} move{checked === 1 ? '' : 's'}{' '}
                I could check.
              </p>
            )
          )
        ) : (
          <>
            <h3 className="fs-6 mt-3">Where it went wrong</h3>
            <div className="list-group">
              {slips.map((record) => (
                <button
                  key={record.ply}
                  type="button"
                  className="list-group-item list-group-item-action"
                  onClick={() => onGoTo(record.ply)}
                >
                  <div>
                    Move {record.ply}: {record.mark} {CELL_NAMES[record.index]}
                  </div>
                  <div className="text-body-secondary small">
                    The position had a {record.mistake.bestOutcome} —{' '}
                    {CELL_NAMES[record.index]}{' '}
                    {describeOutcome(
                      record.mistake.played.outcome,
                      record.mistake.played.distance,
                    )}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
        {unjudged > 0 && (
          <p className="text-body-secondary small mt-2 mb-0">
            {unjudged} move{unjudged === 1 ? '' : 's'} played before the
            analysis arrived and could not be checked.
          </p>
        )}
      </div>
    );
  }

  // Nothing is better than anything else here — an empty board, or any later
  // position the engine rates identically throughout. Calling any of them
  // "best" would be noise, so say the one true thing instead. Every move in
  // such a position shares a verdict, because `best` means optimal on outcome
  // AND distance, so the first move's wording speaks for all of them.
  if (allMovesTied(analysis.moves)) {
    const [any] = analysis.moves;
    const message = TIED_MESSAGE[any.outcome];
    return (
      <div className="text-start">
        <h2 className="fs-5">{message.heading}</h2>
        <p className="text-body-secondary mb-0">
          Every move here {describeOutcome(any.outcome, any.distance)}.{' '}
          {message.body}
        </p>
      </div>
    );
  }

  const shown = visibleMoves(analysis.moves, teaching);
  const best = shown.filter((move) => move.best);
  const rest = shown.filter((move) => !move.best);

  return (
    <div className="text-start">
      <h2 className="fs-5">Best moves</h2>
      <ul className="list-group mb-3">
        {best.map((move) => (
          <MoveRow
            key={move.index}
            move={move}
            hovered={move.index === hoveredIndex}
            onHover={onHover}
          />
        ))}
      </ul>
      {rest.length > 0 && (
        <>
          <h2 className="fs-5">Also legal</h2>
          <ul className="list-group">
            {rest.map((move) => (
              <MoveRow
                key={move.index}
                move={move}
                hovered={move.index === hoveredIndex}
                onHover={onHover}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export default TeachingPanel;
