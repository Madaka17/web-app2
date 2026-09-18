import { useEffect, useState } from "react";
import { getHealth, getMetrics, ModelHealth, ModelMetricsReport } from "./api";

export type Remote<T> =
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "error"; message: string };

function useRemote<T>(load: (signal: AbortSignal) => Promise<T>): Remote<T> {
  const [state, setState] = useState<Remote<T>>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal)
      .then((data) => setState({ status: "ready", data }))
      .catch((e: Error) => {
        if (e.name !== "AbortError") setState({ status: "error", message: e.message });
      });
    return () => controller.abort();
    // `load` is a module-level function, never a fresh closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return state;
}

export function useModelHealth(): Remote<ModelHealth> {
  return useRemote(getHealth);
}

export function useModelMetrics(): Remote<ModelMetricsReport> {
  return useRemote(getMetrics);
}
