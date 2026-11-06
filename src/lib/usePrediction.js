import { useEffect, useState } from "react";
import { predict } from "./api";

const DEBOUNCE_MS = 450;
const EMPTY = { result: null, resultPayload: null, running: false, error: null };

/**
 * Debounced price prediction for a request body. Any earlier request is aborted
 * when the body changes. A null body cancels the pending request and clears the
 * result. The previous result stays on screen while the next one loads.
 */
export function usePrediction(payload) {
  const [state, setState] = useState(EMPTY);
  // Keying on the serialised body means a new object with the same content does not refetch.
  const key = payload ? JSON.stringify(payload) : null;

  useEffect(() => {
    if (key === null) {
      setState(EMPTY);
      return undefined;
    }
    const body = JSON.parse(key);
    const controller = new AbortController();
    setState((s) => ({ ...s, running: true, error: null }));

    const timer = setTimeout(() => {
      predict(body, controller.signal)
        .then((result) => {
          if (controller.signal.aborted) return;
          setState({ result, resultPayload: body, running: false, error: null });
        })
        .catch((err) => {
          if (controller.signal.aborted || err?.name === "AbortError") return;
          setState((s) => ({ ...s, running: false, error: err?.message ?? String(err) }));
        });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key]);

  return state;
}
