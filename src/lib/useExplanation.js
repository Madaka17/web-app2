import { useEffect, useState } from "react";
import { explain } from "./api";

const EMPTY = { explanation: null, loading: false, error: null };

/**
 * Per-property explanation for a request body, fetched after the prediction for
 * the same body has settled. Any earlier request is aborted when the body changes.
 * A null body cancels the pending request and clears the explanation.
 */
export function useExplanation(payload) {
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
    setState({ explanation: null, loading: true, error: null });

    explain(body, controller.signal)
      .then((explanation) => {
        if (controller.signal.aborted) return;
        setState({ explanation, loading: false, error: null });
      })
      .catch((err) => {
        if (controller.signal.aborted || err?.name === "AbortError") return;
        setState({ explanation: null, loading: false, error: err?.message ?? String(err) });
      });

    return () => controller.abort();
  }, [key]);

  return state;
}
