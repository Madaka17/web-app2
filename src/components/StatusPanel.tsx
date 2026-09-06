import { LucideIcon } from "lucide-react";

interface StatusPanelProps {
  icon: LucideIcon;
  title: string;
  description: string;
  /** "empty" draws a dashed placeholder, "loading" draws a spinning ring. */
  variant: "empty" | "loading";
}

export function StatusPanel({ icon: Icon, title, description, variant }: StatusPanelProps) {
  const isLoading = variant === "loading";

  return (
    <div
      className={`h-full min-h-[400px] rounded-2xl bg-white dark:bg-slate-900 flex flex-col items-center justify-center p-8 text-center border ${
        isLoading
          ? "border-slate-200 dark:border-slate-800"
          : "border-dashed border-slate-300 dark:border-slate-700"
      }`}
    >
      {isLoading ? (
        <div className="relative w-20 h-20 mb-6">
          <div className="absolute inset-0 rounded-full border-4 border-slate-200 dark:border-slate-800" />
          <div className="absolute inset-0 rounded-full border-4 border-brand-500 border-t-transparent animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Icon className="w-8 h-8 text-brand-500 animate-pulse" />
          </div>
        </div>
      ) : (
        <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
          <Icon className="w-8 h-8 text-slate-400 dark:text-slate-600" />
        </div>
      )}
      <h3 className="text-base font-bold text-slate-700 dark:text-slate-300 mb-2">{title}</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs">{description}</p>
    </div>
  );
}
