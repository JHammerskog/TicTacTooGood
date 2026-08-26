import { TUTORIALS } from './tutorials.js';

/**
 * The Tutorials index: every lesson by name, with what it is for.
 *
 * Rows are ordered as `TUTORIALS` is, which is the order they teach best in —
 * the first two are a matched pair, the third reuses their lesson from a new
 * opening, and the fourth is the other side of the board. The note says so,
 * because nothing else on screen would.
 */
export default function LearnList({ onOpen, onBack }) {
  return (
    <div className="text-center">
      <h1 className="mb-2">Tutorials</h1>
      <p className="text-body-secondary mb-4">
        Four strategies, tried against real opponents. They build on each other,
        so they make most sense taken in order — start at the top.
      </p>
      <div
        className="d-inline-block text-start w-100"
        style={{ maxWidth: '32rem' }}
      >
        <div className="list-group">
          {TUTORIALS.map((tutorial, index) => (
            <button
              key={tutorial.id}
              type="button"
              className="list-group-item list-group-item-action"
              onClick={() => onOpen(tutorial.id)}
            >
              <div>
                <strong>
                  {index + 1}. {tutorial.name}
                </strong>
              </div>
              <small className="text-body-secondary">{tutorial.summary}</small>
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4">
        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={onBack}
        >
          Back to menu
        </button>
      </div>
    </div>
  );
}
