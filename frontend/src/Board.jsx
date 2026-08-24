const CELL_LABELS = [
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

function Board({ squares, winningLine, lastMove, isOver, onPlay }) {
  const ends = winningLine && lineEnds(winningLine);

  return (
    <div className="board mx-auto">
      {squares.map((square, index) => (
        <button
          key={index}
          type="button"
          className={
            index === lastMove ? 'board-cell board-cell-last' : 'board-cell'
          }
          onClick={() => onPlay(index)}
          aria-disabled={Boolean(square) || isOver}
          aria-label={`${CELL_LABELS[index]}, ${square ?? 'empty'}${
            index === lastMove ? ', last move' : ''
          }`}
        >
          {square}
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
