import { LayoutDashboard, GitBranch, BarChart3, ImagePlus, Home, X } from "lucide-react";
import { PageId } from "@/lib/types";

interface SidebarProps {
  activePage: PageId;
  onNavigate: (page: PageId) => void;
  isOpen: boolean;
  onClose: () => void;
}

const NAV_ITEMS: { id: PageId; label: string; icon: typeof LayoutDashboard; description: string }[] = [
  { id: "predictor", label: "หน้าหลัก", icon: LayoutDashboard, description: "Predictor Dashboard" },
  { id: "used-homes", label: "บ้านมือสอง", icon: Home, description: "Used Homes Data" },
  { id: "image-valuation", label: "ประเมินด้วยรูปภาพ", icon: ImagePlus, description: "Image-Based Valuation" },
  { id: "pipeline", label: "AI Pipeline", icon: GitBranch, description: "Workflow Status" },
  { id: "metrics", label: "เปรียบเทียบโมเดล", icon: BarChart3, description: "Model Metrics" },
];

export function Sidebar({ activePage, onNavigate, isOpen, onClose }: SidebarProps) {
  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`
          fixed lg:sticky top-0 left-0 z-50 lg:z-30
          w-64 h-screen
          bg-white dark:bg-slate-950
          border-r border-slate-200 dark:border-slate-800
          transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          flex flex-col
        `}
      >
        <div className="flex items-center justify-between p-4 lg:hidden border-b border-slate-200 dark:border-slate-800">
          <span className="font-semibold text-slate-900 dark:text-white">Navigation</span>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto scrollbar-thin">
          <p className="px-3 pt-3 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Main Menu
          </p>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  onClose();
                }}
                className={`
                  w-full flex items-start gap-3 px-3 py-3 rounded-xl transition-all duration-200 group
                  ${
                    isActive
                      ? "bg-gradient-to-r from-brand-500/10 to-brand-600/5 dark:from-brand-500/15 dark:to-brand-600/10 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-500/20"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 border border-transparent"
                  }
                `}
              >
                <div
                  className={`
                    p-2 rounded-lg transition-colors
                    ${
                      isActive
                        ? "bg-brand-500 text-white shadow-md shadow-brand-500/30"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:bg-slate-200 dark:group-hover:bg-slate-700"
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 text-left">
                  <p className={`text-sm font-semibold ${isActive ? "text-brand-700 dark:text-brand-300" : ""}`}>
                    {item.label}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">{item.description}</p>
                </div>
                {isActive && (
                  <div className="w-1 h-full rounded-full bg-brand-500 self-stretch" />
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-200 dark:border-slate-800">
          <div className="rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-900 dark:to-slate-800/50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Models Online</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              CatBoost 10% · LightGBM 20% · XGBoost 70% — น้ำหนักเลือกจาก validation ปี 2567
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
