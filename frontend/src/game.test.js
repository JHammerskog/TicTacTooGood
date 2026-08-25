import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateWinner,
  playedCount,
  nextPlayer,
  isDraw,
  isOver,
  CELL_NAMES,
  RULE_TEXT,
  describeOutcome,
  visibleMoves,
  allMovesTied,
  TIED_MESSAGE,
  describeResult,
  playInHistory,
  lastMoveIndex,
  moveLabels,
  judgeMove,
} from './game.js';

/**
 * Builds a board from a 9-character string, reading left-to-right then
 * top-to-bottom. '.' means an empty square.
 */
const board = (cells) => [...cells].map((cell) => (cell === '.' ? null : cell));

test('detects each of the three winning rows', () => {
  assert.deepEqual(calculateWinner(board('XXX.O.O..')), {
    player: 'X',
    line: [0, 1, 2],
  });
  assert.deepEqual(calculateWinner(board('O..XXXO..')), {
    player: 'X',
    line: [3, 4, 5],
  });
  assert.deepEqual(calculateWinner(board('.O..O.XXX')), {
    player: 'X',
    line: [6, 7, 8],
  });
});

test('detects each of the three winning columns', () => {
  assert.deepEqual(calculateWinner(board('X.OX.OX..')), {
    player: 'X',
    line: [0, 3, 6],
  });
  assert.deepEqual(calculateWinner(board('OXOOX..X.')), {
    player: 'X',
    line: [1, 4, 7],
  });
  assert.deepEqual(calculateWinner(board('O.XO.X..X')), {
    player: 'X',
    line: [2, 5, 8],
  });
});

test('detects both diagonals', () => {
  assert.deepEqual(calculateWinner(board('X..OXO..X')), {
    player: 'X',
    line: [0, 4, 8],
  });
  assert.deepEqual(calculateWinner(board('O.XOX.X..')), {
    player: 'X',
    line: [2, 4, 6],
  });
});

test('reports the winning player, not just X', () => {
  assert.deepEqual(calculateWinner(board('OOOXX.X..')), {
    player: 'O',
    line: [0, 1, 2],
  });
});

test('returns null for an empty board', () => {
  assert.equal(calculateWinner(board('.........')), null);
});

test('returns null for a game still in progress', () => {
  assert.equal(calculateWinner(board('XX.OO....')), null);
});

test('returns null for a full board with no winner', () => {
  assert.equal(calculateWinner(board('XXOOOXXOX')), null);
});

test('counts the squares already played', () => {
  assert.equal(playedCount(board('.........')), 0);
  assert.equal(playedCount(board('XX.OO....')), 4);
  assert.equal(playedCount(board('XXOOOXXOX')), 9);
});

test('X plays first and the players alternate', () => {
  assert.equal(nextPlayer(board('.........')), 'X');
  assert.equal(nextPlayer(board('X........')), 'O');
  assert.equal(nextPlayer(board('XO.......')), 'X');
});

test('a full board with no winner is a draw', () => {
  assert.equal(isDraw(board('XXOOOXXOX')), true);
  assert.equal(isDraw(board('XX.OO....')), false);
});

test('a full board that someone won is not a draw', () => {
  assert.equal(isDraw(board('XXXOOXOXO')), false);
});

test('a game is over when it is won or drawn, not before', () => {
  assert.equal(isOver(board('.........')), false);
  assert.equal(isOver(board('XX.OO....')), false);
  assert.equal(isOver(board('XXX.O.O..')), true);
  assert.equal(isOver(board('XXOOOXXOX')), true);
});

test('describes an outcome in plies, in English', () => {
  assert.equal(describeOutcome('win', 0), 'wins now');
  assert.equal(describeOutcome('win', 3), 'wins in 3');
  assert.equal(describeOutcome('loss', 2), 'loses in 2');
  assert.equal(describeOutcome('draw', 4), 'draws');
});

test('every rule the API can return has wording', () => {
  const fromTheApi = [
    'win',
    'block',
    'fork',
    'block_fork',
    'centre',
    'opposite_corner',
    'empty_corner',
    'empty_side',
  ];
  for (const rule of fromTheApi) {
    assert.equal(typeof RULE_TEXT[rule], 'string');
  }
});

test('there is a name for all nine cells', () => {
  assert.equal(CELL_NAMES.length, 9);
  assert.equal(CELL_NAMES[4], 'centre');
});

test('"full" teaching shows every move', () => {
  const moves = [
    { index: 0, best: true },
    { index: 1, best: false },
  ];
  assert.deepEqual(visibleMoves(moves, 'full'), moves);
});

test('"hints" teaching shows only the best moves', () => {
  const moves = [
    { index: 0, best: true },
    { index: 1, best: false },
  ];
  assert.deepEqual(visibleMoves(moves, 'hints'), [moves[0]]);
});

test('a nullish moves argument returns no moves', () => {
  assert.deepEqual(visibleMoves(null, 'full'), []);
  assert.deepEqual(visibleMoves(undefined, 'full'), []);
});

test('teaching off shows nothing, even with an analysis in hand', () => {
  const moves = [
    { index: 0, best: true },
    { index: 1, best: false },
  ];
  assert.deepEqual(visibleMoves(moves, 'off'), []);
});

test('spots a position where every move is equally good', () => {
  const tied = [
    { index: 0, best: true, outcome: 'draw', distance: 8 },
    { index: 1, best: true, outcome: 'draw', distance: 8 },
  ];
  const mixed = [
    { index: 0, best: true, outcome: 'draw', distance: 8 },
    { index: 1, best: false, outcome: 'loss', distance: 1 },
  ];
  assert.equal(allMovesTied(tied), true);
  assert.equal(allMovesTied(mixed), false);
});

test('a single forced move counts as nothing to choose between', () => {
  assert.equal(allMovesTied([{ index: 4, best: true }]), true);
});

test('no moves at all is not a tied position', () => {
  assert.equal(allMovesTied([]), false);
  assert.equal(allMovesTied(null), false);
  assert.equal(allMovesTied(undefined), false);
});

test('every verdict a tied position can carry has its own message', () => {
  for (const outcome of ['draw', 'win', 'loss']) {
    assert.equal(typeof TIED_MESSAGE[outcome].heading, 'string');
    assert.equal(typeof TIED_MESSAGE[outcome].body, 'string');
  }
  // A forced loss must not be told to enjoy its free choice.
  assert.notEqual(TIED_MESSAGE.loss.body, TIED_MESSAGE.draw.body);
  assert.match(TIED_MESSAGE.loss.heading, /Nothing left/);
});

test('names the winner in hotseat by their mark', () => {
  assert.equal(describeResult('X', false, 'X'), 'X won!');
  assert.equal(describeResult('O', false, 'X'), 'O won!');
});

test('names the winner against a computer by who they are, not their mark', () => {
  // The human is X here, so an X win is the human's.
  assert.equal(describeResult('X', true, 'X'), 'Human won!');
  assert.equal(describeResult('O', true, 'X'), 'Computer won.');
  // ...and when the human moves second, the same marks mean the opposite.
  assert.equal(describeResult('O', true, 'O'), 'Human won!');
  assert.equal(describeResult('X', true, 'O'), 'Computer won.');
});

test('a finished game with no winner is drawn, in either mode', () => {
  assert.equal(describeResult(null, false, 'X'), 'Drawn.');
  assert.equal(describeResult(null, true, 'O'), 'Drawn.');
});

test('playing at the tip appends to history', () => {
  const empty = Array(9).fill(null);
  const first = playInHistory([empty], 0, 4, 'X');
  assert.equal(first.history.length, 2);
  assert.equal(first.cursor, 1);
  assert.equal(first.history[1][4], 'X');
  // The earlier position is untouched, not mutated.
  assert.equal(first.history[0][4], null);
});

test('playing from the past discards the future', () => {
  const empty = Array(9).fill(null);
  let state = playInHistory([empty], 0, 4, 'X');
  state = playInHistory(state.history, state.cursor, 0, 'O');
  state = playInHistory(state.history, state.cursor, 8, 'X');
  assert.equal(state.history.length, 4);

  // Step back to just after X's first move, then play something else.
  const branched = playInHistory(state.history, 1, 2, 'O');
  assert.equal(branched.history.length, 3);
  assert.equal(branched.cursor, 2);
  assert.equal(branched.history[2][2], 'O');
  assert.equal(branched.history[2][8], null);
});

test('playing an occupied cell changes nothing', () => {
  const empty = Array(9).fill(null);
  const state = playInHistory([empty], 0, 4, 'X');
  const again = playInHistory(state.history, state.cursor, 4, 'O');
  assert.equal(again.history, state.history);
  assert.equal(again.cursor, state.cursor);
});

test('finds which cell changed between two positions', () => {
  const before = [...'X...O....'].map((c) => (c === '.' ? null : c));
  const after = [...'X.X.O....'].map((c) => (c === '.' ? null : c));
  assert.equal(lastMoveIndex(before, after), 2);
});

test('there is no last move at the start of a game', () => {
  const empty = Array(9).fill(null);
  assert.equal(lastMoveIndex(undefined, empty), null);
  assert.equal(lastMoveIndex(empty, empty), null);
});

test('labels each position in a game', () => {
  const empty = Array(9).fill(null);
  let state = playInHistory([empty], 0, 4, 'X');
  state = playInHistory(state.history, state.cursor, 0, 'O');
  assert.deepEqual(moveLabels(state.history), [
    'Game start',
    '1. X centre',
    '2. O top left',
  ]);
});

test('an empty game has only its start', () => {
  assert.deepEqual(moveLabels([Array(9).fill(null)]), ['Game start']);
});

// X to play on XX.OO.... — index 2 completes the top row.
const winAvailable = {
  moves: [
    { index: 2, outcome: 'win', distance: 0, rule: 'win', best: true },
    { index: 5, outcome: 'draw', distance: 4, rule: 'empty_side', best: false },
    {
      index: 6,
      outcome: 'loss',
      distance: 1,
      rule: 'empty_corner',
      best: false,
    },
    { index: 7, outcome: 'loss', distance: 1, rule: 'block', best: false },
    {
      index: 8,
      outcome: 'loss',
      distance: 1,
      rule: 'empty_corner',
      best: false,
    },
  ],
};

// O to play after X takes the centre — only the corners draw.
const afterCentre = {
  moves: [
    {
      index: 0,
      outcome: 'draw',
      distance: 7,
      rule: 'empty_corner',
      best: true,
    },
    { index: 1, outcome: 'loss', distance: 5, rule: 'empty_side', best: false },
    {
      index: 2,
      outcome: 'draw',
      distance: 7,
      rule: 'empty_corner',
      best: true,
    },
    { index: 3, outcome: 'loss', distance: 5, rule: 'empty_side', best: false },
    { index: 5, outcome: 'loss', distance: 5, rule: 'empty_side', best: false },
    {
      index: 6,
      outcome: 'draw',
      distance: 7,
      rule: 'empty_corner',
      best: true,
    },
    { index: 7, outcome: 'loss', distance: 5, rule: 'empty_side', best: false },
    {
      index: 8,
      outcome: 'draw',
      distance: 7,
      rule: 'empty_corner',
      best: true,
    },
  ],
};

test('flags a move that throws away a win', () => {
  const verdict = judgeMove(winAvailable, 5);
  assert.equal(verdict.played.outcome, 'draw');
  assert.equal(verdict.bestOutcome, 'win');
  assert.deepEqual(
    verdict.alternatives.map((move) => move.index),
    [2],
  );
});

test('flags a move that turns a draw into a loss', () => {
  const verdict = judgeMove(afterCentre, 1);
  assert.equal(verdict.played.outcome, 'loss');
  assert.equal(verdict.bestOutcome, 'draw');
  assert.deepEqual(
    verdict.alternatives.map((move) => move.index),
    [0, 2, 6, 8],
  );
});

test('stays quiet when the outcome is unchanged', () => {
  // Taking the win, and taking one of the four drawing corners.
  assert.equal(judgeMove(winAvailable, 2), null);
  assert.equal(judgeMove(afterCentre, 0), null);
});

test('a slower win is not a mistake', () => {
  const slower = {
    moves: [
      { index: 0, outcome: 'win', distance: 0, rule: 'win', best: true },
      {
        index: 1,
        outcome: 'win',
        distance: 4,
        rule: 'empty_side',
        best: false,
      },
    ],
  };
  assert.equal(judgeMove(slower, 1), null);
});

test('nothing is judged without an analysis', () => {
  assert.equal(judgeMove(null, 4), null);
  assert.equal(judgeMove({ moves: [] }, 4), null);
  assert.equal(judgeMove(afterCentre, 4), null); // 4 is occupied: not a legal move
});
