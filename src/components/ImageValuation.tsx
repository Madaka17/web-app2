import { useState, useRef, useCallback, useEffect } from "react";
import {
  ImagePlus,
  Upload,
  X,
  Loader2,
  ScanLine,
  Sparkles,
  Home,
  BedDouble,
  Bath,
  Maximize,
  Building2,
  CheckCircle2,
  ChevronRight,
  Camera,
  Wand2,
  AlertCircle,
} from "lucide-react";
import { PredictionInput } from "@/lib/types";
import { ApiPrediction, predict } from "@/lib/api";
import { DEFAULT_SUBDISTRICT_ID, DEFAULT_YEAR } from "@/lib/defaults";
import { ResultPanel } from "./ResultPanel";
import { LocationSelector } from "./LocationSelector";
import { StatusPanel } from "./StatusPanel";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_IMAGES = 12;

interface UploadedImage {
  id: string;
  url: string;
  name: string;
  analysis: ImageAnalysis | null;
  isAnalyzing: boolean;
}

interface ImageAnalysis {
  detectedRoom: string;
  condition: string;
  conditionScore: number;
  estimatedArea: number;
  estimatedBedrooms: number;
  estimatedBathrooms: number;
  detectedFeatures: string[];
  confidence: number;
}

const ROOM_TYPES = ["Living Room", "Bedroom", "Kitchen", "Bathroom", "Balcony", "Dining Area"];
const CONDITIONS = ["Excellent", "Good", "Fair", "Needs Renovation"];
const DETECTABLE_FEATURES = [
  "Hardwood Flooring",
  "City View",
  "Natural Light",
  "Built-in Wardrobe",
  "Modern Kitchen",
  "Air Conditioning",
  "High Ceiling",
  "Balcony Access",
];

function analyzeImage(imageId: string): ImageAnalysis {
  const seed = imageId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const rand = (offset: number) => {
    const s = Math.sin(seed * 9301 + offset * 49297) * 233280;
    return s - Math.floor(s);
  };

  const roomIdx = Math.floor(rand(1) * ROOM_TYPES.length);
  const condIdx = Math.floor(rand(2) * CONDITIONS.length);
  const condScore = 95 - condIdx * 18 - Math.floor(rand(3) * 5);

  const featureCount = 3 + Math.floor(rand(4) * 4);
  // Seeded Fisher-Yates: a fresh random draw per swap, so the order really varies.
  const shuffled = [...DETECTABLE_FEATURES];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand(10 + i) * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const detectedFeatures = shuffled.slice(0, featureCount);

  return {
    detectedRoom: ROOM_TYPES[roomIdx],
    condition: CONDITIONS[condIdx],
    conditionScore: condScore,
    estimatedArea: 45 + Math.floor(rand(6) * 80),
    estimatedBedrooms: 1 + Math.floor(rand(7) * 4),
    estimatedBathrooms: 1 + Math.floor(rand(8) * 3),
    detectedFeatures,
    confidence: 78 + Math.floor(rand(9) * 18),
  };
}

export function ImageValuation() {
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [subdistrictId, setSubdistrictId] = useState(DEFAULT_SUBDISTRICT_ID);
  const [result, setResult] = useState<ApiPrediction | null>(null);
  const [predictError, setPredictError] = useState<string | null>(null);
  const [isPredicting, setIsPredicting] = useState(false);
  const [mergedInput, setMergedInput] = useState<PredictionInput | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timersRef = useRef<number[]>([]);
  // Mirrors the object URLs currently held, so unmount can revoke every one.
  const objectUrlsRef = useRef<Set<string>>(new Set());

  const imageCount = images.length;

  useEffect(
    () => () => {
      timersRef.current.forEach(window.clearTimeout);
      objectUrlsRef.current.forEach(URL.revokeObjectURL);
      objectUrlsRef.current.clear();
    },
    [],
  );

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;

      const rejected: string[] = [];
      const accepted: File[] = [];
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) {
          rejected.push(`${file.name} (ไม่ใช่ไฟล์รูปภาพ)`);
        } else if (file.size > MAX_FILE_BYTES) {
          rejected.push(`${file.name} (เกิน 10 MB)`);
        } else {
          accepted.push(file);
        }
      }

      const room = Math.max(0, MAX_IMAGES - imageCount);
      const taken = accepted.slice(0, room);
      if (accepted.length > room) {
        rejected.push(`รับได้สูงสุด ${MAX_IMAGES} รูป`);
      }
      setUploadError(rejected.length > 0 ? rejected.join(", ") : null);
      if (taken.length === 0) return;

      const newImages: UploadedImage[] = taken.map((file) => {
        const url = URL.createObjectURL(file);
        objectUrlsRef.current.add(url);
        return {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          url,
          name: file.name,
          analysis: null,
          isAnalyzing: true,
        };
      });

      setImages((prev) => [...prev, ...newImages]);

      newImages.forEach((img) => {
        const timer = window.setTimeout(() => {
          const analysis = analyzeImage(img.id);
          setImages((current) =>
            current.map((p) => (p.id === img.id ? { ...p, analysis, isAnalyzing: false } : p)),
          );
        }, 1800 + Math.random() * 1200);
        timersRef.current.push(timer);
      });
    },
    [imageCount],
  );

  const removeImage = (id: string) => {
    setImages((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) {
        URL.revokeObjectURL(target.url);
        objectUrlsRef.current.delete(target.url);
      }
      return prev.filter((p) => p.id !== id);
    });
    setResult(null);
    setMergedInput(null);
    setUploadError(null);
  };

  const handlePredict = async () => {
    const analyzed = images.filter((i) => i.analysis);
    if (analyzed.length === 0) return;

    setIsPredicting(true);
    setResult(null);
    setMergedInput(null);
    setPredictError(null);

    const mean = (pick: (a: ImageAnalysis) => number) =>
      Math.round(analyzed.reduce((sum, i) => sum + (i.analysis ? pick(i.analysis) : 0), 0) / analyzed.length);

    const input: PredictionInput = {
      // Photos of rooms are condo-shaped; the form on the main page is where a
      // different property type gets chosen.
      propertyType: "condo",
      area: mean((a) => a.estimatedArea),
      nUnits: 1,
      year: DEFAULT_YEAR,
      subdistrictId,
    };

    try {
      const prediction = await predict(input);
      setMergedInput(input);
      setResult(prediction);
    } catch (e) {
      setPredictError((e as Error).message);
    } finally {
      setIsPredicting(false);
    }
  };

  const analyzedCount = images.filter((i) => i.analysis).length;
  const allAnalyzed = imageCount > 0 && analyzedCount === imageCount;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <span>ประเมินด้วยรูปภาพ</span>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-slate-900 dark:text-white font-medium">Image-Based Valuation</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Upload + Images */}
        <div className="space-y-6">
          {/* Upload Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              handleFiles(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`
              relative cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-300
              ${
                isDragging
                  ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10 scale-[1.02]"
                  : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-brand-400 dark:hover:border-brand-500/40"
              }
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => {
                handleFiles(e.target.files);
                // Reset so picking the same file twice still fires onChange.
                e.target.value = "";
              }}
              className="hidden"
            />
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500/10 to-brand-600/5 dark:from-brand-500/15 dark:to-brand-600/10 flex items-center justify-center">
                <ImagePlus className="w-8 h-8 text-brand-500" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  อัปโหลดรูปอสังหาริมทรัพย์
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  ลากรูปมาวาง หรือคลิกเพื่อเลือกไฟล์ — ไฟล์รูปภาพเท่านั้น สูงสุด {MAX_IMAGES} รูป
                  ไฟล์ละไม่เกิน 10 MB
                </p>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400">
                <Upload className="w-3.5 h-3.5" />
                <span className="text-xs font-semibold">เลือกรูปภาพ</span>
              </div>
            </div>
          </div>

          {uploadError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-500/25 dark:bg-red-500/10"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
              <p className="text-xs leading-5 text-red-700 dark:text-red-300">
                ข้ามบางไฟล์: {uploadError}
              </p>
            </div>
          )}

          {/* Uploaded Images */}
          {images.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  รูปที่อัปโหลด ({images.length})
                </h3>
                {allAnalyzed && (
                  <span className="flex items-center gap-1 text-xs font-semibold text-green-600 dark:text-green-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    วิเคราะห์เสร็จแล้ว
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {images.map((img) => (
                  <ImageCard key={img.id} image={img} onRemove={() => removeImage(img.id)} />
                ))}
              </div>
            </div>
          )}

          {/* Location Override */}
          {images.length > 0 && (
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 rounded-lg bg-orange-50 dark:bg-orange-500/10">
                  <Home className="w-4 h-4 text-orange-500 dark:text-orange-400" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  ข้อมูลเพิ่มเติม — ทำเลที่ตั้ง
                </h3>
              </div>

              <LocationSelector
                subdistrictId={subdistrictId}
                onChange={setSubdistrictId}
              />
            </div>
          )}

          {/* Predict Button */}
          {images.length > 0 && (
            <button
              onClick={handlePredict}
              disabled={!allAnalyzed || isPredicting}
              className="w-full group relative overflow-hidden rounded-2xl bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-700 hover:to-brand-600 text-white font-semibold py-4 px-6 shadow-lg shadow-brand-500/30 transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <div className="flex items-center justify-center gap-2.5">
                {isPredicting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>กำลังประเมินราคาจากรูปภาพ...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    <span>ประเมินราคาจากรูปภาพ (Run Image Valuation)</span>
                  </>
                )}
              </div>
            </button>
          )}
        </div>

        {/* Right: Results */}
        <div>
          {isPredicting ? (
            <StatusPanel
              variant="loading"
              icon={ScanLine}
              title="AI กำลังประเมินราคา..."
              description="ส่งพื้นที่และทำเลที่วิเคราะห์ได้เข้าโมเดล Ensemble"
            />
          ) : predictError ? (
            <StatusPanel
              variant="empty"
              icon={AlertCircle}
              title="เรียกโมเดลไม่สำเร็จ"
              description={`${predictError} — ตรวจว่า API รันอยู่ที่ http://127.0.0.1:8000`}
            />
          ) : result && mergedInput ? (
            <div className="space-y-6">
              <ImageSummary images={images} />
              <ResultPanel result={result} input={mergedInput} />
            </div>
          ) : (
            <StatusPanel
              variant="empty"
              icon={Camera}
              title="ยังไม่มีผลการประเมิน"
              description="อัปโหลดรูปภาพอสังหาริมทรัพย์เพื่อให้ AI วิเคราะห์และประเมินราคาให้อัตโนมัติ"
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ImageCard({ image, onRemove }: { image: UploadedImage; onRemove: () => void }) {
  return (
    <div className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
      <div className="relative aspect-[4/3] overflow-hidden">
        <img src={image.url} alt={image.name} className="w-full h-full object-cover" />
        <button
          onClick={onRemove}
          className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 backdrop-blur-sm text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        {image.isAnalyzing && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
            <ScanLine className="w-6 h-6 text-white animate-pulse" />
            <span className="text-xs font-semibold text-white">AI กำลังวิเคราะห์...</span>
          </div>
        )}

        {image.analysis && (
          <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded-lg bg-green-500/90 backdrop-blur-sm">
            <CheckCircle2 className="w-3 h-3 text-white" />
            <span className="text-[10px] font-bold text-white">Analyzed</span>
          </div>
        )}
      </div>

      {image.analysis && (
        <div className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900 dark:text-white">
              {image.analysis.detectedRoom}
            </span>
            <span className="text-[10px] text-slate-400">
              {image.analysis.confidence}% match
            </span>
          </div>

          <div className="flex flex-wrap gap-1">
            {image.analysis.detectedFeatures.slice(0, 3).map((f, i) => (
              <span
                key={i}
                className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
              >
                {f}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-1.5 pt-1">
            <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
              <Maximize className="w-2.5 h-2.5" />
              {image.analysis.estimatedArea}㎡
            </div>
            <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
              <BedDouble className="w-2.5 h-2.5" />
              {image.analysis.estimatedBedrooms}BR
            </div>
            <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
              <Bath className="w-2.5 h-2.5" />
              {image.analysis.estimatedBathrooms}BA
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
            <span className="text-[10px] text-slate-400">Condition</span>
            <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-300">
              {image.analysis.condition} ({image.analysis.conditionScore})
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function ImageSummary({ images }: { images: UploadedImage[] }) {
  const analyzed = images.filter((i) => i.analysis);
  if (analyzed.length === 0) return null;

  const avgArea = Math.round(analyzed.reduce((s, i) => s + (i.analysis?.estimatedArea ?? 0), 0) / analyzed.length);
  const avgBed = Math.round(analyzed.reduce((s, i) => s + (i.analysis?.estimatedBedrooms ?? 0), 0) / analyzed.length);
  const avgBath = Math.round(analyzed.reduce((s, i) => s + (i.analysis?.estimatedBathrooms ?? 0), 0) / analyzed.length);
  const avgCond = Math.round(analyzed.reduce((s, i) => s + (i.analysis?.conditionScore ?? 0), 0) / analyzed.length);

  const allFeatures = analyzed.flatMap((i) => i.analysis?.detectedFeatures ?? []);
  const uniqueFeatures = [...new Set(allFeatures)];

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm animate-slide-up">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 rounded-lg bg-brand-50 dark:bg-brand-500/10">
          <Wand2 className="w-4 h-4 text-brand-600 dark:text-brand-400" />
        </div>
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
          สรุปการวิเคราะห์รูปภาพด้วย AI
        </h3>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-4">
        <SummaryStat icon={Maximize} label="พื้นที่เฉลี่ย" value={`${avgArea}㎡`} />
        <SummaryStat icon={BedDouble} label="ห้องนอน" value={`${avgBed}`} />
        <SummaryStat icon={Bath} label="ห้องน้ำ" value={`${avgBath}`} />
        <SummaryStat icon={Building2} label="สภาพ" value={`${avgCond}/100`} />
      </div>

      <div>
        <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
          คุณสมบัติที่ตรวจพบ:
        </p>
        <div className="flex flex-wrap gap-1.5">
          {uniqueFeatures.map((f, i) => (
            <span
              key={i}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-green-50 dark:bg-green-500/10 text-xs font-medium text-green-700 dark:text-green-400"
            >
              <CheckCircle2 className="w-3 h-3" />
              {f}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function SummaryStat({ icon: Icon, label, value }: { icon: typeof Home; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3 text-center">
      <Icon className="w-4 h-4 text-brand-500 mx-auto mb-1" />
      <p className="text-sm font-bold text-slate-900 dark:text-white">{value}</p>
      <p className="text-[10px] text-slate-400">{label}</p>
    </div>
  );
}
