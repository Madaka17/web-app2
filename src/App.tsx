import { useState } from "react";
import { ThemeProvider } from "@/context/ThemeContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { PredictorDashboard } from "@/components/PredictorDashboard";
import { PipelineBoard } from "@/components/PipelineBoard";
import { ModelMetrics } from "@/components/ModelMetrics";
import { ImageValuation } from "@/components/ImageValuation";
import { UsedHomes } from "@/components/UsedHomes";
import { useHashRoute } from "@/lib/useHashRoute";

function AppContent() {
  const [activePage, navigate] = useHashRoute();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors">
      <div className="flex">
        <Sidebar
          activePage={activePage}
          onNavigate={navigate}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <div className="flex-1 min-w-0">
          <Header onMenuClick={() => setSidebarOpen(true)} />

          <main className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
            <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-500/25 dark:bg-amber-500/10">
              <span className="mt-0.5 rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-slate-900">
                ข้อจำกัด
              </span>
              <p className="text-xs leading-5 text-amber-800 dark:text-amber-200">
                ระดับราคาอ้างอิง{" "}
                <strong className="font-bold">ราคาประเมินทางการของกรมธนารักษ์</strong>{" "}
                (ราคาประเมินห้องชุดรายอาคาร · ราคาประเมินที่ดิน 5.2 ล้านแปลง · ค่าก่อสร้างรายจังหวัด)
                แต่<strong className="font-bold">รายการประเมินเป็นข้อมูลจำลอง</strong> —
                ตัวเลขที่ได้จึงเป็นระดับราคาที่สมเหตุสมผลของทำเลและประเภทนั้น
                ไม่ใช่บันทึกการประเมินที่เกิดขึ้นจริง และไม่ใช่ราคาตลาดซื้อขาย
              </p>
            </div>

            {activePage === "predictor" && <PredictorDashboard />}
            {activePage === "used-homes" && <UsedHomes />}
            {activePage === "image-valuation" && <ImageValuation />}
            {activePage === "pipeline" && <PipelineBoard />}
            {activePage === "metrics" && <ModelMetrics />}
          </main>

          <footer className="px-4 sm:px-6 lg:px-8 py-6 border-t border-slate-200 dark:border-slate-800 mt-8">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
              <p className="text-xs text-slate-400 dark:text-slate-600">
                AI Real Estate Price Predictor — CatBoost · LightGBM · XGBoost ensemble
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-600">
                ราคาอ้างอิงกรมธนารักษ์ · รายการจำลอง 2561–2567 · ทดสอบกับปี 2568–2569
              </p>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
