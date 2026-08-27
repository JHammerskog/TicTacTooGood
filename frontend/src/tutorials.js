import facts from './tutorials.json' with { type: 'json' };
import {
  nextPlayer,
  other,
  playedCount,
  playInHistory,
  positionKey,
  winningSquares,
} from './game.js';

/**
 * Replay a tutorial's line into one position per move.
 *
 * @param {number[]} line - Cell indices, played alternately starting with X.
 * @returns {Array<Array<string|null>>} The empty board, then one position per
 *   move in the line.
 */
function positions(line) {
  let state = { history: [Array(9).fill(null)], cursor: 0 };
  line.forEach((index, ply) => {
    state = playInHistory(
      state.history,
      state.cursor,
      index,
      ply % 2 ? 'O' : 'X',
    );
  });
  return state.history;
}

/**
 * Pair each position in a line with the commentary for reaching it.
 *
 * @param {number[]} line - The tutorial's three scripted moves.
 * @param {string[]} notes - One note per position, including the empty board.
 * @returns {Array<{board: Array<string|null>, note: string}>} The steps.
 */
function steps(line, notes) {
  return positions(line).map((board, ply) => ({ board, note: notes[ply] }));
}

const NOTES = {
  'centre-first': [
    'You take the centre. It sits on four of the eight lines, more than any other square.',
    'They answer with a corner. It is their only reply that does not lose outright — so far they have played well.',
    'You take the corner opposite theirs. Nothing threatens anything: no two of your marks share a line, so there is nothing for them to block.',
    'And that is the trap. Four of their six replies now lose. Every side loses; only the two remaining corners survive. A player scanning for a block sees nothing to do and picks a square that feels harmless. And when they take a side, watch what happens: their move makes a threat, so you block it — and the block is itself the fork. The move that looks like defence is the move that wins.',
  ],
  'corner-first': [
    'You take a corner.',
    'They answer with the centre — again their only reply that does not lose.',
    'You take the corner opposite your first. Two of your marks on one diagonal, with their mark between: no threat, nothing to block.',
    'Now the mirror of the last lesson. Two of their six replies lose, and this time it is the corners that kill them. A corner saved them a moment ago and loses for them here — which is why a habit cannot rescue them. Whichever corner they take, you take the other one. It blocks the line they just made, and leaves you two ways to win.',
  ],
  'side-first': [
    'You open on a side. It looks like the weakest square on the board, which is part of why this works.',
    'They answer with a corner touching your side — a sound reply.',
    'You take the side perpendicular to your first, wrapping an L around their corner. Your two marks do not share a line, so once again there is nothing to block.',
    'Three of their six replies lose, and every one of them is a corner — the square novices reach for. Whichever corner they take, your answer is the same one: the centre.',
  ],
};

const PRACTICE = {
  'centre-first': {
    replies: [0, 1],
    goal: 'Open in the centre, set the trap, and punish the side they play.',
  },
  'corner-first': {
    replies: [4, 2],
    goal: 'Open in a corner, set the trap, and punish the corner they play.',
  },
  'side-first': {
    replies: [0, 2],
    goal: 'Open on a side, wrap the L, and punish the corner they play.',
  },
};

const NAMES = {
  'centre-first': 'Centre first',
  'corner-first': 'Corner first',
  'side-first': 'Side first',
};

const SUMMARIES = {
  'centre-first': 'The deadliest trap: four of their six replies lose.',
  'corner-first': 'The mirror image — here it is the corners that kill them.',
  'side-first':
    'The weakest-looking opening, and the punish is always the same square.',
};

/**
 * The four tutorials, in teaching order.
 *
 * The three attacking tutorials are built from `tutorials.json`, which a
 * backend test proves against the solver — so the prose here can never claim
 * something the engine disagrees with without that test failing.
 */
export const TUTORIALS = [
  ...facts.map((fact) => {
    const walkthrough = steps(fact.line, NOTES[fact.id]);
    return {
      id: fact.id,
      name: NAMES[fact.id],
      summary: SUMMARIES[fact.id],
      mark: 'X',
      line: fact.line,
      punish: fact.punish,
      losing: fact.losing,
      safe: fact.safe,
      steps: walkthrough,
      // The position with the trap set, keyed by shape so a game that met it
      // rotated still matches. The last step is that position by construction.
      trapKey: positionKey(walkthrough.at(-1).board),
      practice: PRACTICE[fact.id],
      rules: null,
    };
  }),
  {
    id: 'going-second',
    name: 'Going second',
    summary:
      'You cannot win unless your opponent severely blunders. Here is how not to lose.',
    mark: 'O',
    line: [],
    punish: {},
    losing: [],
    safe: [],
    steps: [],
    trapKey: null,
    practice: null,
    rules: [
      'If they take a corner, take the middle or lose. The centre is the only square that does not lose.',
      'If they take the middle, take a corner or lose. Any of the four will do.',
      'If they open on a side, neither rule above covers it — and it is the nastiest case to hold in your head: two of the four corners lose, and so do two of the three remaining sides. Take the middle. It is always safe there, and Side first shows what happens when you get this wrong.',
      'Then watch for the traps in the first three lessons — the only positions where nothing needs blocking and you can still lose.',
      'Follow the first two rules and the draw is always there. You can still throw it later; these only get you past the opening.',
    ],
  },
];

/**
 * Look a tutorial up by its id.
 *
 * @param {string} id - The tutorial's id.
 * @returns {object|undefined} The tutorial, or undefined if there is no such id.
 */
export function findTutorial(id) {
  return TUTORIALS.find((tutorial) => tutorial.id === id);
}

/**
 * The scripted opponent's move.
 *
 * It plays the first reply in its list that is still free — a reply the player
 * has taken is skipped rather than retried. Once the list is used up it stops
 * being scripted and behaves like a person: it takes a win if it has one, and
 * otherwise blocks a win it can see.
 *
 * That last part matters. This used to fall through to the first free cell in
 * index order, so after the punish created a fork it would play some unrelated
 * square and let the player complete a line nobody had tried to stop — which no
 * real opponent would ever do, and which made the lesson's payoff look fake.
 * Blocking one threat is also the honest picture: a fork wins precisely because
 * blocking one still loses to the other.
 *
 * @param {Array<string|null>} board - The position to move in.
 * @param {number[]} replies - The scripted replies, in order.
 * @returns {number} The cell to play, or -1 if the board is full.
 */
export function scriptedReply(board, replies) {
  const scripted = replies.find((index) => board[index] === null);
  if (scripted !== undefined) {
    return scripted;
  }
  const mine = nextPlayer(board);
  const theirs = other(mine);
  const [win] = winningSquares(board, mine);
  const [block] = winningSquares(board, theirs);
  return win ?? block ?? board.findIndex((cell) => cell === null);
}

/**
 * The move the tutorial's line calls for in this position.
 *
 * @param {Array<string|null>} board - The position the player is looking at.
 * @param {object} tutorial - The tutorial being practised.
 * @returns {number|null} The expected cell, or null if the player has left the
 *   line and there is nothing to expect.
 */
export function expectedMove(board, tutorial) {
  const played = playedCount(board);
  if (played === 0) {
    return tutorial.line[0] ?? null;
  }
  if (played === 2) {
    return board[tutorial.line[0]] === 'X' ? tutorial.line[2] : null;
  }
  if (played === 4) {
    if (board[tutorial.line[0]] !== 'X' || board[tutorial.line[2]] !== 'X') {
      return null;
    }
    const theirs = board.findIndex(
      (cell, index) => cell === 'O' && index !== tutorial.line[1],
    );
    return tutorial.punish[String(theirs)] ?? null;
  }
  return null;
}

/**
 * The tutorial explaining a loss, when the player walked into a taught trap.
 *
 * Three things must hold: the human lost, a move of theirs was flagged as an
 * outcome-changing mistake, and the position they played it in was one of the
 * taught traps under any rotation or reflection.
 *
 * Only one ply can ever match — a trap position holds exactly three marks — but
 * the walk is written generally rather than hardcoding ply 4, so a longer
 * tutorial line would not break it silently.
 *
 * @param {object} game - The finished game.
 * @param {Array<Array<'X' | 'O' | null>>} game.history - Every position, from
 *   the empty board.
 * @param {Array<{ply: number, mistake: object|null}>} game.records - One entry
 *   per human move.
 * @param {'X' | 'O' | null} game.humanMark - The human's mark, null in hotseat.
 * @param {'X' | 'O' | null} game.winner - Who won, or null if nobody did.
 * @returns {{tutorial: object, ply: number, rotated: boolean} | null} The
 *   tutorial to offer, which ply lost it, and whether the board was turned
 *   relative to the way the tutorial teaches it.
 */
export function findTrapLoss({ history, records, humanMark, winner }) {
  if (!humanMark || !winner || winner === humanMark) {
    return null;
  }
  for (const record of records) {
    const before = record.mistake ? history[record.ply - 1] : null;
    if (!before || nextPlayer(before) !== humanMark) {
      continue;
    }
    const key = positionKey(before);
    const tutorial = TUTORIALS.find((entry) => entry.trapKey === key);
    if (tutorial) {
      const taught = tutorial.steps.at(-1).board;
      return {
        tutorial,
        ply: record.ply,
        rotated: !before.every((cell, index) => cell === taught[index]),
      };
    }
  }
  return null;
}
