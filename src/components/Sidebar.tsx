import { LayoutDashboard, GitBranch, BarChart3, ImagePlus, Home, X } from "lucide-react";
import { PageId } from "@/lib/types";
import { useModelHealth } from "@/lib/useApi";

interface SidebarProps {
  activePage: PageId;
  onNavigate: (page: PageId) => void;
  isOpen: boolean;
  onClose: () => void;
}

const NAV_ITEMS: { id: PageId; label: string; icon: typeof LayoutDashboard; hint: string }[] = [
  { id: "predictor", label: "ประเมินราคา", icon: LayoutDashboard, hint: "กรอกข้อมูล รับราคา" },
  { id: "used-homes", label: "บ้านมือสอง", icon: Home, hint: "รายการในระบบ" },
  { id: "image-valuation", label: "ประเมินจากรูป", icon: ImagePlus, hint: "อัปโหลดรูปห้อง" },
  { id: "pipeline", label: "กระบวนการ", icon: GitBranch, hint: "จากข้อมูลดิบถึง API" },
  { id: "metrics", label: "ผลทดสอบโมเดล", icon: BarChart3, hint: "ตัวเลขจริงจากชุดทดสอบ" },
];

export function Sidebar({ activePage, onNavigate, isOpen, onClose }: SidebarProps) {
  const health = useModelHealth();

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-[2px] lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`
          fixed left-0 top-0 z-50 flex h-dvh w-[248px] flex-col border-r border-line/80 bg-surface
          transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]
          lg:sticky lg:z-30 lg:translate-x-0
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Brand */}
        <div className="flex h-16 items-center justify-between px-5">
          <a href="#/predictor" className="flex items-center gap-2.5" onClick={onClose}>
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink font-display text-sm font-bold text-canvas">
              ฿
            </span>
            <span className="leading-tight">
              <span className="block font-display text-[15px] font-semibold tracking-tight text-ink">
                ราคาบ้าน
              </span>
              <span className="block text-[10.5px] text-muted">กรุงเทพฯ และปริมณฑล</span>
            </span>
          </a>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted transition-colors hover:bg-raised hover:text-ink lg:hidden"
            aria-label="ปิดเมนู"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pt-2 scrollbar-thin" aria-label="หน้าหลัก">
          <p className="label px-3 pb-2 pt-3">เมนู</p>
          <ul className="space-y-0.5">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.id;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => {
                      onNavigate(item.id);
                      onClose();
                    }}
                    aria-current={isActive ? "page" : undefined}
                    className={`
                      group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left
                      transition-colors duration-150
                      ${isActive ? "bg-raised text-ink" : "text-muted hover:bg-raised/70 hover:text-ink"}
                    `}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-accent" />
                    )}
                    <Icon
                      className={`h-[18px] w-[18px] flex-shrink-0 transition-colors ${
                        isActive ? "text-accent" : "text-faint group-hover:text-muted"
                      }`}
                      strokeWidth={isActive ? 2.25 : 1.75}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px] font-medium leading-tight">{item.label}</span>
                      <span className="block truncate text-[11px] text-faint">{item.hint}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Model status footer */}
        <div className="border-t border-line/80 p-3">
          <div className="rounded-xl bg-raised p-3.5">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                {health.status === "ready" && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok opacity-60" />
                )}
                <span
                  className={`relative inline-flex h-2 w-2 rounded-full ${
                    health.status === "ready" ? "bg-ok" : health.status === "error" ? "bg-bad" : "bg-faint"
                  }`}
                />
              </span>
              <span className="text-xs font-semibold text-ink">
                {health.status === "ready"
                  ? "โมเดลออนไลน์"
                  : health.status === "error"
                    ? "ต่อ API ไม่ได้"
                    : "กำลังเช็ค API"}
              </span>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
              {health.status === "ready" ? (
                <>
                  {Object.entries(health.data.weights)
                    .sort((a, b) => b[1] - a[1])
                    .map(([n, w]) => `${n} ${Math.round(w * 100)}%`)
                    .join(" · ")}
                </>
              ) : health.status === "error" ? (
                <>
                  รัน <code className="num text-[10px]">python ml/api.py</code> แล้วรีเฟรช
                </>
              ) : (
                "รอสักครู่"
              )}
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
