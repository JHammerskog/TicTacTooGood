import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  allMovesTied,
  calculateWinner,
  CELL_NAMES,
  describeOutcome,
  describeResult,
  isDraw,
  isOver,
  judgeMove,
  lastMoveIndex,
  moveLabels,
  nextPlayer,
  other,
  playedCount,
  playInHistory,
  RULE_TEXT,
  TIED_MESSAGE,
  visibleMoves,
  winningSquares,
} from './game.js';
import {
  TUTORIALS,
  findTutorial,
  scriptedReply,
  expectedMove,
} from './tutorials.js';
import facts from './tutorials.json' with { type: 'json' };

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

test('every tutorial has a name, a summary and a mark', () => {
  assert.equal(TUTORIALS.length, 4);
  for (const tutorial of TUTORIALS) {
    assert.ok(tutorial.name.length > 0, tutorial.id);
    assert.ok(tutorial.summary.length > 0, tutorial.id);
    assert.ok(['X', 'O'].includes(tutorial.mark), tutorial.id);
  }
});

test('the three attacking tutorials walk through their line', () => {
  const attacking = TUTORIALS.filter((tutorial) => tutorial.practice);
  assert.equal(attacking.length, 3);
  for (const tutorial of attacking) {
    // Empty board, then one position per scripted move.
    assert.equal(tutorial.steps.length, 4, tutorial.id);
    assert.equal(tutorial.steps[0].board.filter(Boolean).length, 0);
    assert.equal(tutorial.steps[3].board.filter(Boolean).length, 3);
    for (const step of tutorial.steps) {
      assert.ok(step.note.length > 0, tutorial.id);
    }
  }
});

test('the defending tutorial has rules and no practice', () => {
  const going = findTutorial('going-second');
  assert.equal(going.practice, null);
  assert.equal(going.steps.length, 0);
  assert.equal(going.rules.length, 5);
});

test('the scripted opponent plays its replies in order', () => {
  const board = Array(9).fill(null);
  board[4] = 'X';
  // centre-first scripts [0, 1]: the sound corner, then a losing side.
  assert.equal(scriptedReply(board, [0, 1]), 0);
  board[0] = 'O';
  board[8] = 'X';
  assert.equal(scriptedReply(board, [0, 1]), 1);
});

test('the scripted opponent skips a reply the player has taken', () => {
  const board = Array(9).fill(null);
  board[0] = 'X';
  assert.equal(scriptedReply(board, [0, 1]), 1);
});

test('the scripted opponent falls back to any free cell', () => {
  const board = Array(9).fill('X');
  board[5] = null;
  assert.equal(scriptedReply(board, [0, 1]), 5);
  assert.equal(scriptedReply(Array(9).fill('X'), [0, 1]), -1);
});

test('the expected move follows the line, then the punish', () => {
  const centre = findTutorial('centre-first');
  const board = Array(9).fill(null);
  assert.equal(expectedMove(board, centre), 4);

  board[4] = 'X';
  board[0] = 'O';
  assert.equal(expectedMove(board, centre), 8);

  board[8] = 'X';
  board[1] = 'O'; // they fall for it with a side
  assert.equal(expectedMove(board, centre), 2);
});

test('there is no expected move once the player leaves the line', () => {
  const centre = findTutorial('centre-first');
  const board = Array(9).fill(null);
  board[4] = 'X';
  board[0] = 'O';
  board[5] = 'X'; // not the opposite corner
  board[2] = 'O'; // not a square the punish table covers
  assert.equal(expectedMove(board, centre), null);
});

test('there is no expected move when the second move misses the fork', () => {
  const centre = findTutorial('centre-first');
  const board = Array(9).fill(null);
  board[4] = 'X';
  board[scriptedReply(board, centre.practice.replies)] = 'O';
  board[5] = 'X'; // deviation: not the opposite corner (8)
  board[scriptedReply(board, centre.practice.replies)] = 'O';
  assert.equal(expectedMove(board, centre), null);
});

test("the scripted opponent's first reply is the corner the punish table targets", () => {
  for (const tutorial of TUTORIALS.filter((t) => t.practice)) {
    assert.equal(tutorial.practice.replies[0], tutorial.line[1], tutorial.id);
  }
});

test('every practice line, played out with the scripted opponent, wins', () => {
  // Simulates the whole practice phase: the player follows expectedMove
  // (falling back to any immediate win once the line is exhausted), the
  // opponent follows scriptedReply. If a tutorial's replies were changed to
  // a square that does not lose, the punish move would no longer be in
  // `punish`, expectedMove would return null, no square would win
  // immediately, and the guard below would catch the stuck position.
  const attacking = TUTORIALS.filter((tutorial) => tutorial.practice);
  for (const tutorial of attacking) {
    let squares = Array(9).fill(null);
    let guard = 0;
    while (!isOver(squares) && guard < 9) {
      guard += 1;
      const turn = nextPlayer(squares);
      let index;
      if (turn === tutorial.mark) {
        const expected = expectedMove(squares, tutorial);
        index =
          expected ??
          squares.findIndex((cell, cellIndex) => {
            if (cell !== null) {
              return false;
            }
            const attempt = squares.slice();
            attempt[cellIndex] = tutorial.mark;
            return calculateWinner(attempt)?.player === tutorial.mark;
          });
      } else {
        index = scriptedReply(squares, tutorial.practice.replies);
      }
      assert.ok(index >= 0, `${tutorial.id}: no move available`);
      const next = squares.slice();
      next[index] = turn;
      squares = next;
    }
    assert.equal(calculateWinner(squares)?.player, tutorial.mark, tutorial.id);
  }
});

const COUNT_WORDS = { 2: 'Two', 3: 'Three', 4: 'Four' };

test('the last step note names how many replies lose', () => {
  const attacking = TUTORIALS.filter((tutorial) => tutorial.practice);
  for (const tutorial of attacking) {
    const fact = facts.find((entry) => entry.id === tutorial.id);
    const word = COUNT_WORDS[fact.losing.length];
    const lastNote = tutorial.steps[tutorial.steps.length - 1].note;
    assert.match(lastNote, new RegExp(`\\b${word}\\b`, 'i'), tutorial.id);
  }
});

test('winning squares finds both halves of a fork', () => {
  const board = [...'OOX.X...X'].map((c) => (c === '.' ? null : c));
  // X holds 2, 4 and 8: playing 5 completes the right column, 6 the diagonal.
  assert.deepEqual(winningSquares(board, 'X'), [5, 6]);
  assert.deepEqual(winningSquares(board, 'O'), []);
  assert.deepEqual(winningSquares(Array(9).fill(null), 'X'), []);
});

test('the scripted opponent blocks a win it can see', () => {
  // X holds two corners of the top row with the middle free.
  const board = [...'X.X.O....'].map((c) => (c === '.' ? null : c));
  assert.equal(scriptedReply(board, []), 1);
});

test('the scripted opponent takes its own win ahead of blocking', () => {
  // O to move: O completes the left column at 6, X would complete 2-5-8 at 8.
  const board = [...'OXXO.X...'].map((c) => (c === '.' ? null : c));
  assert.equal(nextPlayer(board), 'O');
  assert.deepEqual(winningSquares(board, 'O'), [6]);
  assert.deepEqual(winningSquares(board, 'X'), [8]);
  assert.equal(scriptedReply(board, []), 6);
});

test('the scripted opponent never leaves a win of ours unanswered', () => {
  for (const tutorial of TUTORIALS.filter((t) => t.practice)) {
    const board = Array(9).fill(null);
    const theirs = other(tutorial.mark);
    while (!calculateWinner(board) && board.includes(null)) {
      const mine = playedCount(board) % 2 === 0;
      if (mine) {
        const wanted = expectedMove(board, tutorial);
        board[wanted ?? winningSquares(board, tutorial.mark)[0]] =
          tutorial.mark;
        continue;
      }
      // Their turn: if we were one move from winning, they had to answer it.
      const threats = winningSquares(board, tutorial.mark);
      const reply = scriptedReply(board, tutorial.practice.replies);
      if (threats.length > 0 && winningSquares(board, theirs).length === 0) {
        assert.ok(
          threats.includes(reply),
          `${tutorial.id}: we threatened ${threats} and they played ${reply}`,
        );
      }
      board[reply] = theirs;
    }
  }
});
