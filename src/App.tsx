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
    <div className="min-h-dvh bg-canvas text-ink">
      <div className="flex">
        <Sidebar
          activePage={activePage}
          onNavigate={navigate}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <div className="min-w-0 flex-1">
          <Header activePage={activePage} onMenuClick={() => setSidebarOpen(true)} />

          <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {activePage === "predictor" && <PredictorDashboard />}
            {activePage === "used-homes" && <UsedHomes />}
            {activePage === "image-valuation" && <ImageValuation />}
            {activePage === "pipeline" && <PipelineBoard />}
            {activePage === "metrics" && <ModelMetrics />}
          </main>

          <footer className="mx-auto mt-6 w-full max-w-6xl px-4 pb-8 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-1.5 border-t border-line/70 pt-5 text-[11.5px] leading-relaxed text-faint sm:flex-row sm:items-start sm:justify-between">
              <p>
                CatBoost · LightGBM · XGBoost — เทรนจากประกาศขายบน dotproperty
                ทดสอบกับปีที่โมเดลไม่เคยเห็น
              </p>
              <p className="sm:max-w-sm sm:text-right">
                โมเดลเห็นแค่ ประเภท · พื้นที่ · เขต · จังหวัด · ปี — ใช้เป็นตัวเลขตั้งต้น
                ไม่ใช่ราคาประเมินทางการ
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
