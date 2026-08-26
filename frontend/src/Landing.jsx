/**
 * The front door. Two choices and nothing else.
 *
 * The page this replaced was really a game-setup form with a Tutorials button
 * beside it, so the tutorials were competing against three questions about an
 * opponent rather than against an equal choice. Splitting the two decisions —
 * what do you want to do, and only then how should the game be set up — is what
 * lets this page have an opinion about which one to pick first.
 */
export default function Landing({ onLearn, onPlay }) {
  return (
    <div className="text-center">
      <h1 className="display-5 mb-2">TicTacTooGood</h1>
      <p className="text-body-secondary fs-5 mb-5">
        Nearly every game of tic-tac-toe is a draw. These are the patterns that
        decide the ones that aren't.
      </p>

      <div
        className="d-grid gap-3 mx-auto text-start"
        style={{ maxWidth: '32rem' }}
      >
        <button
          type="button"
          className="btn btn-primary btn-lg p-4 text-start"
          onClick={onLearn}
        >
          <span className="fs-3 d-block">Learn</span>
          <span className="fs-6">
            Four traps that win real games against real people. Start here.
          </span>
        </button>

        <button
          type="button"
          className="btn btn-outline-secondary text-start"
          onClick={onPlay}
        >
          <strong>Play a game</strong>
          <span className="d-block small">
            Hotseat, or against the computer. Best once you have done the
            tutorials.
          </span>
        </button>
      </div>
    </div>
  );
}
