import {
  CELL_NAMES,
  RULE_TEXT,
  allMovesTied,
  describeOutcome,
  visibleMoves,
} from './game.js';

/** Maps a cell index to the centre of that cell in the SVG's 3x3 coordinate space. */
const cellCentre = (index) => ({
  x: (index % 3) + 0.5,
  y: Math.floor(index / 3) + 0.5,
});

/** How far past each end cell's centre the win line reaches, in cell widths. */
const OVERSHOOT = 0.25;

/**
 * Endpoints of the line across a winning triple. Each end runs a quarter of a
 * cell past the outer centres, so the line covers 75% of its end cells instead
 * of stopping dead in the middle of a glyph.
 */
const lineEnds = (line) => {
  const from = cellCentre(line[0]);
  const to = cellCentre(line[2]);
  const dx = Math.sign(to.x - from.x) * OVERSHOOT;
  const dy = Math.sign(to.y - from.y) * OVERSHOOT;
  return { x1: from.x - dx, y1: from.y - dy, x2: to.x + dx, y2: to.y + dy };
};

function Board({
  squares,
  winningLine,
  lastMove,
  disabled,
  onPlay,
  moves = null,
  teaching = 'off',
  hoveredIndex = null,
  onHover = () => {},
}) {
  const ends = winningLine && lineEnds(winningLine);

  // In "Best move" only the optimal cells are annotated, so the rest of the
  // position stays unspoiled — including in the aria-labels.
  //
  // When every move is tied there is nothing to single out: the stars go away,
  // and "Best move" annotates nothing at all rather than starring the whole
  // board. "Every move" still tints, because seeing the position is its job.
  const tied = allMovesTied(moves);
  const shown =
    tied && teaching !== 'full' ? [] : visibleMoves(moves, teaching);
  const analysis = new Map(shown.map((move) => [move.index, move]));

  function cellClass(index) {
    const move = analysis.get(index);
    const classes = ['board-cell'];
    if (index === lastMove) {
      classes.push('board-cell-last');
    }
    if (move && teaching === 'full') {
      classes.push(`board-cell-${move.outcome}`);
    }
    if (move && index === hoveredIndex) {
      classes.push('board-cell-linked');
    }
    return classes.join(' ');
  }

  function cellLabel(index, square) {
    const parts = [CELL_NAMES[index], square ?? 'empty'];
    if (index === lastMove) {
      parts.push('last move');
    }
    const move = analysis.get(index);
    if (move) {
      // The verdict goes in the label because the tint alone must not be the
      // only way to learn it (WCAG 1.4.1).
      parts.push(describeOutcome(move.outcome, move.distance));
      parts.push(RULE_TEXT[move.rule] ?? move.rule);
    }
    return parts.join(', ');
  }

  return (
    <div className="board mx-auto">
      {squares.map((square, index) => (
        <button
          key={index}
          type="button"
          className={cellClass(index)}
          onClick={() => onPlay(index)}
          onMouseEnter={() => onHover(index)}
          onMouseLeave={() => onHover(null)}
          onFocus={() => onHover(index)}
          onBlur={() => onHover(null)}
          aria-disabled={Boolean(square) || disabled}
          aria-label={cellLabel(index, square)}
        >
          {square ??
            (!tied && analysis.get(index)?.best ? (
              <span className="board-star" aria-hidden="true">
                ★
              </span>
            ) : null)}
        </button>
      ))}
      {winningLine && (
        <svg className="win-line" viewBox="0 0 3 3" aria-hidden="true">
          <line x1={ends.x1} y1={ends.y1} x2={ends.x2} y2={ends.y2} />
        </svg>
      )}
    </div>
  );
}

export default Board;
