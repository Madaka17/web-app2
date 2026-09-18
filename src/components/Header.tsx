import { Menu, Moon, Sun } from "lucide-react";
import { useTheme } from "@/context/theme";
import { PageId } from "@/lib/types";

interface HeaderProps {
  activePage: PageId;
  onMenuClick: () => void;
}

const TITLES: Record<PageId, { th: string; en: string }> = {
  predictor: { th: "ประเมินราคา", en: "Valuation" },
  "used-homes": { th: "บ้านมือสอง", en: "Listings" },
  "image-valuation": { th: "ประเมินจากรูป", en: "Photo valuation" },
  pipeline: { th: "กระบวนการ", en: "Pipeline" },
  metrics: { th: "ผลทดสอบโมเดล", en: "Model report" },
};

export function Header({ activePage, onMenuClick }: HeaderProps) {
  const { mode, toggle } = useTheme();
  const title = TITLES[activePage];

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-canvas/85 backdrop-blur-md">
      <div className="flex h-14 items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            className="-ml-1 rounded-lg p-2 text-muted transition-colors hover:bg-raised hover:text-ink lg:hidden"
            aria-label="เปิดเมนู"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="flex items-baseline gap-2">
            <span className="font-display text-[15px] font-semibold tracking-tight text-ink">{title.th}</span>
            <span className="hidden text-[11px] uppercase tracking-label text-faint sm:inline">{title.en}</span>
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <span className="chip hidden border-warn/25 bg-warn-soft text-warn sm:inline-flex">
            ราคาประกาศขาย ไม่ใช่ราคาประเมินทางการ
          </span>
          <button
            onClick={toggle}
            className="rounded-lg border border-line bg-surface p-2 text-muted transition-all duration-200 hover:border-faint/60 hover:text-ink active:scale-95"
            aria-label={mode === "dark" ? "สลับเป็นโหมดสว่าง" : "สลับเป็นโหมดมืด"}
          >
            {mode === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </header>
  );
}
