import {
  Database,
  SlidersHorizontal,
  ShieldCheck,
  Rocket,
  CheckCircle2,
  Loader2,
  Clock,
  ChevronRight,
  Cpu,
  GitBranch,
} from "lucide-react";
import { PIPELINE_STAGES } from "@/lib/data";
import { PipelineStage } from "@/lib/types";

const STAGE_ICONS = {
  building: Database,
  validating: SlidersHorizontal,
  review: ShieldCheck,
  ready: Rocket,
} as const;

const TONE_STYLES: Record<string, string> = {
  green: "bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/20",
  yellow: "bg-yellow-50 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-500/20",
  blue: "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20",
  gray: "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700",
};

export function PipelineBoard() {
  const completedCount = PIPELINE_STAGES.filter((s) => s.state === "done").length;
  const overallProgress = (completedCount / PIPELINE_STAGES.length) * 100;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <span>AI Pipeline</span>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-slate-900 dark:text-white font-medium">Workflow Status</span>
      </div>

      {/* Summary Bar */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-brand-50 dark:bg-brand-500/10">
              <GitBranch className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Pipeline Progress</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {completedCount} of {PIPELINE_STAGES.length} stages complete
              </p>
            </div>
          </div>
          <span className="text-2xl font-bold gradient-text">{overallProgress.toFixed(0)}%</span>
        </div>
        <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-500 to-green-400 transition-all duration-1000"
            style={{ width: `${overallProgress}%` }}
          />
        </div>
      </div>

      {/* Kanban Flow */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {PIPELINE_STAGES.map((stage, index) => (
          <StageCard key={stage.id} stage={stage} index={index} />
        ))}
      </div>
    </div>
  );
}

function StageCard({ stage, index }: { stage: PipelineStage; index: number }) {
  const Icon = STAGE_ICONS[stage.id];
  const isActive = stage.state === "active";
  const isDone = stage.state === "done";

  return (
    <div
      className={`
        relative rounded-2xl border p-5 transition-all duration-300
        ${
          isActive
            ? "bg-white dark:bg-slate-900 border-brand-300 dark:border-brand-500/30 shadow-lg shadow-brand-500/10"
            : isDone
            ? "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm"
            : "bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800/50"
        }
      `}
    >
      {/* Connector arrow (desktop) */}
      {index < PIPELINE_STAGES.length - 1 && (
        <div className="hidden xl:flex absolute top-1/2 -right-2.5 -translate-y-1/2 z-10">
          <div className="w-5 h-5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center">
            <ChevronRight className="w-3 h-3 text-slate-400" />
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div
          className={`
            p-2.5 rounded-xl transition-all
            ${
              isActive
                ? "bg-brand-500 text-white shadow-md shadow-brand-500/30"
                : isDone
                ? "bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400"
                : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600"
            }
          `}
        >
          {isDone ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : isActive ? (
            <Icon className="w-5 h-5" />
          ) : (
            <Clock className="w-5 h-5" />
          )}
        </div>

        <span
          className={`
            px-2.5 py-1 rounded-full text-[10px] font-semibold border
            ${TONE_STYLES[stage.badge.tone]}
          `}
        >
          {stage.badge.label}
        </span>
      </div>

      {/* Title */}
      <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-0.5">{stage.title}</h4>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{stage.subtitle}</p>

      {/* Progress */}
      {stage.progress > 0 && (
        <div className="mb-4">
          <div className="flex justify-between text-[10px] text-slate-400 mb-1">
            <span>Progress</span>
            <span className="font-semibold">{stage.progress}%</span>
          </div>
          <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${
                isDone ? "bg-green-500" : "bg-brand-500"
              }`}
              style={{ width: `${stage.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Tasks */}
      <div className="space-y-2">
        {stage.tasks.map((task, i) => (
          <div key={i} className="flex items-center gap-2">
            {isDone ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
            ) : isActive && i < 2 ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
            ) : isActive && i === 2 ? (
              <Loader2 className="w-3.5 h-3.5 text-brand-500 animate-spin flex-shrink-0" />
            ) : (
              <div className="w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-slate-600 flex-shrink-0" />
            )}
            <span
              className={`text-xs ${
                isDone || (isActive && i < 2)
                  ? "text-slate-600 dark:text-slate-400"
                  : isActive
                  ? "text-slate-900 dark:text-white font-medium"
                  : "text-slate-400 dark:text-slate-600"
              }`}
            >
              {task}
            </span>
          </div>
        ))}
      </div>

      {/* Active animation */}
      {isActive && (
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Cpu className="w-3.5 h-3.5 text-brand-500 animate-pulse" />
            <span className="text-[10px] text-brand-600 dark:text-brand-400 font-medium">
              Processing on GPU cluster...
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
