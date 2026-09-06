import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled error in UI:", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
        <div className="max-w-md w-full rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-500/10">
            <AlertTriangle className="h-7 w-7 text-red-500" />
          </div>
          <h1 className="text-base font-bold text-slate-900 dark:text-white">
            เกิดข้อผิดพลาดในหน้านี้
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            ระบบหยุดทำงานชั่วคราว ลองโหลดหน้าใหม่อีกครั้ง
          </p>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-50 dark:bg-slate-800/60 p-3 text-left text-[11px] text-slate-500 dark:text-slate-400">
            {error.message}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
          >
            <RotateCcw className="h-4 w-4" />
            โหลดหน้าใหม่
          </button>
        </div>
      </div>
    );
  }
}
