import { LucideIcon } from "lucide-react";

interface StatusPanelProps {
  icon: LucideIcon;
  title: string;
  description: string;
  /** "empty" draws a dashed placeholder, "loading" draws a result skeleton. */
  variant: "empty" | "loading";
}

export function StatusPanel({ icon: Icon, title, description, variant }: StatusPanelProps) {
  if (variant === "loading") {
    return (
      <div className="card animate-fade-in p-6" role="status" aria-live="polite">
        <span className="sr-only">{title}</span>
        <div className="flex items-center gap-2 text-xs text-muted">
          <Icon className="h-3.5 w-3.5 animate-pulse text-accent" />
          {title}
        </div>
        <div className="mt-5 space-y-3">
          <Bone className="h-3 w-24" />
          <Bone className="h-11 w-3/4" />
          <div className="flex gap-2 pt-1">
            <Bone className="h-6 w-28" />
            <Bone className="h-6 w-28" />
          </div>
        </div>
        <div className="mt-8 space-y-2.5">
          <Bone className="h-3 w-32" />
          <Bone className="h-2.5 w-full" />
          <Bone className="h-2.5 w-5/6" />
          <Bone className="h-2.5 w-2/3" />
        </div>
        <p className="mt-6 text-[11px] text-faint">{description}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[380px] flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface/60 p-8 text-center">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-raised text-faint">
        <Icon className="h-5 w-5" strokeWidth={1.75} />
      </span>
      <h3 className="mt-4 font-display text-[15px] font-semibold text-ink">{title}</h3>
      <p className="mt-1.5 max-w-xs text-[13px] leading-relaxed text-muted">{description}</p>
    </div>
  );
}

function Bone({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-md bg-raised ${className}`} />;
}
