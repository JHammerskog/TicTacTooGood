import {
  CELL_NAMES,
  RULE_TEXT,
  TIED_MESSAGE,
  allMovesTied,
  describeResult,
  describeOutcome,
  visibleMoves,
} from './game.js';

const DIAL_OPTIONS = [
  {
    value: 'off',
    label: 'Off',
    hint: 'Just play. The board tells you nothing.',
  },
  {
    value: 'hints',
    label: 'Best move',
    hint: 'Stars the strongest move and names the pattern behind it.',
  },
  {
    value: 'full',
    label: 'Every move',
    hint: 'Rates every square: what it leads to and what it is called.',
  },
];

/**
 * The three-position teaching control. Three positions rather than two
 * checkboxes because "every move" strictly contains "best move" — two
 * checkboxes would imply four states where there are three.
 *
 * `describe` adds a line explaining the chosen setting. The start screen wants
 * it, because there is no board on screen to make the setting self-evident;
 * in-game the board is right there, so the dial stays compact.
 */
export function TeachingDial({ value, onChange, describe = false }) {
  const chosen = DIAL_OPTIONS.find((option) => option.value === value);

  return (
    <fieldset className="mb-3">
      <legend className="fs-6 text-body-secondary">Teaching mode</legend>
      <div className="btn-group" role="group">
        {DIAL_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={
              option.value === value
                ? 'btn btn-primary'
                : 'btn btn-outline-primary'
            }
            aria-pressed={option.value === value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      {describe && (
        <p className="text-body-secondary small mt-2 mb-0" aria-live="polite">
          {chosen?.hint}
        </p>
      )}
    </fieldset>
  );
}

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
    return (
      <div className="text-start">
        <h2 className="fs-5 mb-0">
          {describeResult(analysis.winner, vsComputer, humanMark)}
        </h2>
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
