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
                โมเดล CatBoost / LightGBM / XGBoost เทรนจากข้อมูลประเมินจริง 250,697 รายการ (ปี
                2561–2567) แต่ข้อมูลชุดนี้มีแค่ พื้นที่ · ประเภท · เขต · จังหวัด · จำนวนหน่วย · ปี
                ค่าคลาดเคลื่อนกลางจึงอยู่ที่ 20% (คอนโด) ถึง 34% (บ้าน/ที่ดิน) —
                ใช้เป็นตัวเลขตั้งต้น ไม่ใช่ราคาประเมินทางการ
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
                เทรนจากข้อมูลประเมินจริง 2561–2567 · ทดสอบกับปี 2568–2569
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
