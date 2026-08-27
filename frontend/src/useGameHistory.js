import { useEffect, useState } from 'react';
import { lastMoveIndex, playInHistory } from './game.js';

/** Gap between plies while replaying, so a jump reads as a sequence. */
const REPLAY_STEP_MS = 180;

/**
 * The board's past, and movement through it.
 *
 * A played game and a scripted tutorial line are the same thing to this hook:
 * an array of positions and a cursor into it. That is why it is a hook rather
 * than state inside `Game` — the tutorial walkthrough needs the navigation
 * without the game around it.
 *
 * @param {() => void} [onStep] - Called once per ply actually
 *   advanced or rewound, including each ply of a replay. Used for the pencil
 *   sound; a component with nothing to do per step can omit it.
 * Move labels are deliberately not returned: only the game screen shows a move
 * list, and only while it is expanded, so `moveLabels(history)` belongs at that
 * call site rather than being rebuilt here on every render of every consumer.
 *
 * @returns {{history: Array<Array<string|null>>, cursor: number,
 *   squares: Array<string|null>, lastMove: number|null,
 *   atTip: boolean, replaying: boolean,
 *   playAt: (index: number, mark: string) => void,
 *   goTo: (ply: number) => void, reset: () => void}}
 */
export function useGameHistory(onStep) {
  const [history, setHistory] = useState(() => [Array(9).fill(null)]);
  const [cursor, setCursor] = useState(0);
  // Where navigation is heading. The cursor walks toward it a ply at a time so
  // a jump replays the moves between instead of snapping.
  const [target, setTarget] = useState(null);

  const squares = history[cursor];
  const atTip = cursor === history.length - 1;
  const replaying = target !== null && target !== cursor;

  useEffect(() => {
    if (target === null || target === cursor) {
      return undefined;
    }
    const step = target > cursor ? 1 : -1;
    const timer = setTimeout(() => {
      onStep?.();
      setCursor(cursor + step);
    }, REPLAY_STEP_MS);
    return () => clearTimeout(timer);
    // `onStep` is deliberately omitted: callers pass a plain function recreated
    // every render, so listing it would make this effect depend on its own
    // render rather than on `target`/`cursor`, which are the only inputs that
    // should restart the timer.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [target, cursor]);

  function playAt(index, mark) {
    if (squares[index] !== null) {
      return;
    }
    onStep?.();
    setTarget(null);
    const next = playInHistory(history, cursor, index, mark);
    setHistory(next.history);
    setCursor(next.cursor);
  }

  function goTo(ply) {
    setTarget(ply);
  }

  function reset() {
    // A fresh array, not a shared constant: identity is what re-triggers
    // useAnalysis's fetch (and re-rolls a perfect opponent's random opening),
    // and setState bails out on an identical reference.
    setHistory([Array(9).fill(null)]);
    setCursor(0);
    setTarget(null);
  }

  return {
    history,
    cursor,
    squares,
    lastMove: lastMoveIndex(history[cursor - 1], squares),
    atTip,
    replaying,
    playAt,
    goTo,
    reset,
  };
}
