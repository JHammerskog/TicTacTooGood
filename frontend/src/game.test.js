import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateWinner } from './game.js';

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
