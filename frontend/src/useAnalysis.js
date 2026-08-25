import { useCallback, useEffect, useState } from 'react';

/** How long to wait before treating a silent backend as a failure. */
const REQUEST_TIMEOUT_MS = 8000;

/**
 * Fetches the engine's analysis of a board.
 *
 * @param {Array<'X' | 'O' | null>} board - The position to analyse.
 * @param {'perfect' | 'fallible' | null} opponent - Send a value only when it
 *   is the computer's turn; the response's `suggested` is null otherwise.
 * @param {boolean} enabled - When false, no request is made at all.
 * @returns {{ data: object | null, loading: boolean, error: string | null,
 *   retry: () => void }}
 */
export function useAnalysis(board, opponent, enabled) {
  const [state, setState] = useState({
    data: null,
    loading: false,
    error: null,
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) {
      // A fetch hook is exactly the "synchronising with an external system" case this
      // rule exempts; resetting here is what clears stale analysis when teaching is
      // switched off.
      // oxlint-disable-next-line react/set-state-in-effect
      setState({ data: null, loading: false, error: null });
      return undefined;
    }

    // Aborting on cleanup is what stops a slow response for an earlier board
    // arriving after a later one and overwriting it.
    const controller = new AbortController();
    // A hung backend is not a failed one: without this the promise never
    // settles, so `loading` stays true forever and the Retry button — which
    // renders only on an error — never appears.
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);
    setState({ data: null, loading: true, error: null });

    fetch('/api/analyse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(opponent ? { board, opponent } : { board }),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(
            body.error ?? `The server returned ${response.status}.`,
          );
        }
        return response.json();
      })
      .then((data) =>
        setState({ data: { ...data, board }, loading: false, error: null }),
      )
      .catch((error) => {
        if (error.name === 'AbortError') {
          if (timedOut) {
            setState({
              data: null,
              loading: false,
              error: 'The server did not respond.',
            });
          }
          return;
        }
        setState({ data: null, loading: false, error: error.message });
      });

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [board, opponent, enabled, attempt]);

  const retry = useCallback(() => setAttempt((count) => count + 1), []);

  return { ...state, retry };
}
