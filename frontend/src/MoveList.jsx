/**
 * The list of positions in the current game. Hidden behind a button rather
 * than always on screen: it is reference material, not something you watch.
 */
function MoveList({ labels, cursor, onJump }) {
  return (
    <div className="list-group text-start">
      {labels.map((label, ply) => (
        <button
          key={ply}
          type="button"
          className={
            ply === cursor
              ? 'list-group-item list-group-item-action active'
              : 'list-group-item list-group-item-action'
          }
          aria-current={ply === cursor ? 'true' : undefined}
          onClick={() => onJump(ply)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export default MoveList;
