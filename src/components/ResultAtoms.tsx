import { Check, Download, FileJson, FileSpreadsheet, FileText } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PredictionInput } from "@/lib/types";
import { formatBaht } from "@/lib/prediction";
import { useAnimatedNumber } from "@/lib/useAnimatedNumber";
import { ApiPrediction } from "@/lib/api";
import { downloadFile, reportToJSON, reportToCSV, reportToText } from "@/lib/download";

export function Baht({ value }: { value: number }) {
  return <>{formatBaht(useAnimatedNumber(value))}</>;
}

export function Num({ value }: { value: number }) {
  return <>{Math.round(useAnimatedNumber(value)).toLocaleString("en-US")}</>;
}

export function DownloadMenu({
  input,
  result,
  triggerClassName = "btn-ghost",
  fullWidth = false,
}: { input: PredictionInput; result: ApiPrediction } & { triggerClassName?: string; fullWidth?: boolean }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handleDownload = (format: "json" | "csv" | "txt") => {
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    if (format === "json") {
      downloadFile(reportToJSON(input, result), `prediction-report-${ts}.json`, "application/json");
    } else if (format === "csv") {
      downloadFile(reportToCSV(input, result), `prediction-report-${ts}.csv`, "text/csv");
    } else {
      downloadFile(reportToText(input, result), `prediction-report-${ts}.txt`, "text/plain");
    }
    setOpen(false);
    setDone(format);
    window.setTimeout(() => setDone(null), 1600);
  };

  const options = [
    { id: "json" as const, icon: FileJson, label: "JSON", hint: "ข้อมูลดิบ" },
    { id: "csv" as const, icon: FileSpreadsheet, label: "CSV", hint: "เปิดใน Excel / Sheets" },
    { id: "txt" as const, icon: FileText, label: "Text", hint: "สรุปอ่านง่าย" },
  ];

  return (
    <div className={fullWidth ? "relative w-full" : "relative"} ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={triggerClassName}
      >
        {done ? <Check className="h-4 w-4 text-ok" /> : <Download className="h-4 w-4" />}
        {done ? "บันทึกแล้ว" : "บันทึกรายงาน"}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-1.5 w-56 overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-pop animate-fade-in"
        >
          {options.map((o) => (
            <button
              key={o.id}
              role="menuitem"
              onClick={() => handleDownload(o.id)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-raised"
            >
              <o.icon className="h-4 w-4 flex-shrink-0 text-muted" strokeWidth={1.75} />
              <span>
                <span className="block text-[13px] font-medium text-ink">{o.label}</span>
                <span className="block text-[11px] text-faint">{o.hint}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
