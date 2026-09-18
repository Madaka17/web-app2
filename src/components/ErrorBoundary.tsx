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
      <div className="flex min-h-dvh items-center justify-center bg-canvas p-6">
        <div className="card w-full max-w-md p-6 text-center">
          <div className="mx-auto mb-4 grid h-11 w-11 place-items-center rounded-xl bg-bad-soft">
            <AlertTriangle className="h-5 w-5 text-bad" />
          </div>
          <h1 className="font-display text-[16px] font-semibold text-ink">
            เกิดข้อผิดพลาดในหน้านี้
          </h1>
          <p className="mt-2 text-sm text-muted">
            ระบบหยุดทำงานชั่วคราว ลองโหลดหน้าใหม่อีกครั้ง
          </p>
          <pre className="num mt-3 overflow-x-auto rounded-lg bg-raised p-3 text-left text-[11px] text-muted">
            {error.message}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary mt-4"
          >
            <RotateCcw className="h-4 w-4" />
            โหลดหน้าใหม่
          </button>
        </div>
      </div>
    );
  }
}
