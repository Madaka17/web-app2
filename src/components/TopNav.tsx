import { useEffect, useRef, useState } from "react";
import { Menu, Moon, Sun, X } from "lucide-react";
import { useTheme } from "@/context/theme";
import { PageId } from "@/lib/types";
import { useModelHealth } from "@/lib/useApi";

interface TopNavProps {
  activePage: PageId;
  onNavigate: (page: PageId) => void;
}

const NAV_ITEMS: { id: PageId; label: string }[] = [
  { id: "predictor", label: "ประเมินราคา" },
  { id: "map", label: "แผนที่" },
  { id: "grades", label: "เกรดโครงการ" },
  { id: "used-homes", label: "บ้านมือสอง" },
  { id: "image-valuation", label: "ประเมินจากรูป" },
  { id: "pipeline", label: "กระบวนการ" },
  { id: "metrics", label: "ผลทดสอบโมเดล" },
];

export function TopNav({ activePage, onNavigate }: TopNavProps) {
  const { mode, toggle } = useTheme();
  const health = useModelHealth();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  const weights =
    health.status === "ready"
      ? Object.entries(health.data.weights)
          .sort((a, b) => b[1] - a[1])
          .map(([n, w]) => `${n} ${Math.round(w * 100)}%`)
          .join(" · ")
      : "";
  const statusTitle =
    health.status === "ready"
      ? `โมเดลออนไลน์ — ${weights}`
      : health.status === "error"
        ? "ต่อ API ไม่ได้ — รัน python ml/api.py แล้วรีเฟรช"
        : "กำลังเช็ค API";

  const go = (id: PageId) => {
    onNavigate(id);
    setOpen(false);
  };

  return (
    <header
      ref={wrapRef}
      className={`sticky top-0 z-40 border-b transition-colors duration-200 ${
        scrolled
          ? "border-line/60 bg-canvas/70 backdrop-blur-xl"
          : "border-transparent bg-transparent"
      }`}
    >
      <div className="relative mx-auto flex h-16 w-full max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <a href="#/predictor" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <span className="grid h-8 w-8 place-items-center brand-mark rounded-lg font-display text-sm font-bold text-white">
            ฿
          </span>
          <span className="font-display text-[15px] font-semibold tracking-tight text-ink">
            ราคาบ้าน
          </span>
        </a>

        <nav className="hidden xl:flex xl:items-center xl:gap-7" aria-label="หน้าหลัก">
          {NAV_ITEMS.map((item) => {
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => go(item.id)}
                aria-current={isActive ? "page" : undefined}
                className={`relative whitespace-nowrap py-2 text-[13px] transition-colors ${
                  isActive ? "text-ink" : "text-muted hover:text-ink"
                }`}
              >
                {item.label}
                {isActive && (
                  <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-accent shadow-[0_0_10px_rgb(var(--c-glow))]" />
                )}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <span
            className="relative flex h-2.5 w-2.5"
            title={statusTitle}
            role="status"
            aria-label={statusTitle}
          >
            {health.status === "ready" && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok opacity-60" />
            )}
            <span
              className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                health.status === "ready"
                  ? "bg-ok"
                  : health.status === "error"
                    ? "bg-bad"
                    : "bg-faint"
              }`}
            />
          </span>
          <button
            onClick={toggle}
            className="rounded-lg border border-line bg-surface/60 p-2 text-muted transition-all duration-200 hover:border-faint/60 hover:text-ink active:scale-95"
            aria-label={mode === "dark" ? "สลับเป็นโหมดสว่าง" : "สลับเป็นโหมดมืด"}
          >
            {mode === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button
            onClick={() => setOpen((v) => !v)}
            className="rounded-lg border border-line bg-surface/60 p-2 text-muted transition-colors hover:text-ink xl:hidden"
            aria-label={open ? "ปิดเมนู" : "เปิดเมนู"}
            aria-expanded={open}
            aria-controls="topnav-panel"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {open && (
        <div
          id="topnav-panel"
          className="absolute inset-x-0 top-full border-b border-line/60 bg-canvas/95 backdrop-blur-xl xl:hidden"
        >
          <ul className="mx-auto max-w-6xl space-y-0.5 px-4 py-3 sm:px-6">
            {NAV_ITEMS.map((item) => {
              const isActive = activePage === item.id;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => go(item.id)}
                    aria-current={isActive ? "page" : undefined}
                    className={`w-full rounded-lg px-3 py-2.5 text-left text-[13.5px] transition-colors ${
                      isActive
                        ? "bg-accent/15 text-ink"
                        : "text-muted hover:bg-raised/70 hover:text-ink"
                    }`}
                  >
                    {item.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </header>
  );
}
