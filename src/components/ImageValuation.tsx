import { useState, useRef, useCallback, useEffect } from "react";
import {
  ImagePlus,
  X,
  Loader2,
  ScanLine,
  BedDouble,
  Bath,
  Maximize,
  Building2,
  Check,
  Camera,
  AlertCircle,
  ArrowRight,
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
    <div className="space-y-8">
      <div className="max-w-xl">
        <h2 className="font-display text-[28px] font-semibold leading-[1.15] tracking-tight text-ink sm:text-[32px]">
          ถ่ายรูปห้อง แล้วให้ระบบเดาขนาด
        </h2>
        <p className="mt-3 text-[14px] leading-relaxed text-muted">
          ระบบอ่านรูปเพื่อประเมินพื้นที่คร่าว ๆ แล้วส่งเข้าโมเดลราคาเดียวกับหน้าประเมิน
          <span className="text-faint"> — ตัวอ่านรูปยังเป็นตัวจำลอง ผลจากรูปจึงเป็นค่าประมาณ</span>
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
        {/* Left: Upload + Images */}
        <div className="space-y-5 lg:col-span-5">
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
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            className={`relative cursor-pointer rounded-2xl border border-dashed p-8 text-center transition-all duration-200 ease-out ${
              isDragging
                ? "border-accent bg-accent-soft"
                : "border-line bg-surface hover:border-faint/70 hover:bg-raised/60"
            }`}
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
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-raised text-muted">
                <ImagePlus className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <div>
                <p className="text-[14px] font-semibold text-ink">ลากรูปมาวาง หรือคลิกเลือก</p>
                <p className="mt-1 text-[12px] text-muted">
                  รูปภาพเท่านั้น · สูงสุด {MAX_IMAGES} รูป · ไฟล์ละไม่เกิน 10 MB
                </p>
              </div>
            </div>
          </div>

          {uploadError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-bad/25 bg-bad-soft px-4 py-3"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-bad" />
              <p className="text-[12.5px] leading-5 text-bad">
                ข้ามบางไฟล์: {uploadError}
              </p>
            </div>
          )}

          {/* Uploaded Images */}
          {images.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-baseline justify-between">
                <h3 className="label">
                  รูป <span className="num">{images.length}</span>/{MAX_IMAGES}
                </h3>
                <span className="num text-[11px] text-muted">
                  {allAnalyzed ? "อ่านครบแล้ว" : `อ่านแล้ว ${analyzedCount}/${images.length}`}
                </span>
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
            <div className="card p-5 sm:p-6">
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
              className="btn-primary group w-full py-3.5 text-[15px]"
            >
              {isPredicting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  กำลังประเมิน
                </>
              ) : (
                <>
                  ประเมินราคาจากรูป
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          )}
        </div>

        {/* Right: Results */}
        <div className="lg:col-span-7">
          {isPredicting ? (
            <StatusPanel
              variant="loading"
              icon={ScanLine}
              title="ส่งพื้นที่กับทำเลเข้าโมเดล"
              description="ใช้พื้นที่เฉลี่ยจากทุกรูป ประเภททรัพย์เป็นคอนโด"
            />
          ) : predictError ? (
            <StatusPanel
              variant="empty"
              icon={AlertCircle}
              title="เรียกโมเดลไม่สำเร็จ"
              description={`${predictError} — ตรวจว่า API รันอยู่ที่ http://127.0.0.1:3030`}
            />
          ) : result && mergedInput ? (
            <div className="space-y-4">
              <ImageSummary images={images} />
              <ResultPanel result={result} input={mergedInput} />
            </div>
          ) : (
            <StatusPanel
              variant="empty"
              icon={Camera}
              title="ยังไม่มีผล"
              description="อัปโหลดรูปห้องอย่างน้อยหนึ่งรูป รอระบบอ่านเสร็จ แล้วกด “ประเมินราคาจากรูป”"
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ImageCard({ image, onRemove }: { image: UploadedImage; onRemove: () => void }) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-line/80 bg-surface shadow-card">
      <div className="relative aspect-[4/3] overflow-hidden bg-raised">
        <img src={image.url} alt={image.name} className="h-full w-full object-cover" />
        <button
          onClick={onRemove}
          className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-ink/60 text-white opacity-0 backdrop-blur transition-all duration-200 hover:bg-bad focus-visible:opacity-100 group-hover:opacity-100 active:scale-90"
          aria-label={`ลบ ${image.name}`}
        >
          <X className="h-3.5 w-3.5" />
        </button>

        {image.isAnalyzing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-ink/50 backdrop-blur-sm">
            <ScanLine className="h-5 w-5 animate-pulse text-white" />
            <span className="text-[11px] font-medium text-white">กำลังอ่านรูป</span>
          </div>
        )}

        {image.analysis && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-surface/95 px-1.5 py-0.5 text-[10px] font-semibold text-ok">
            <Check className="h-3 w-3" strokeWidth={2.5} />
            {image.analysis.confidence}%
          </span>
        )}
      </div>

      {image.analysis && (
        <div className="space-y-2 p-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-[13px] font-semibold text-ink">{image.analysis.detectedRoom}</span>
            <span className="num flex-shrink-0 text-[11px] text-muted">
              {image.analysis.condition} · {image.analysis.conditionScore}
            </span>
          </div>

          <div className="num flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-muted">
            <span className="inline-flex items-center gap-1">
              <Maximize className="h-3 w-3 text-faint" />
              {image.analysis.estimatedArea} ตร.ม.
            </span>
            <span className="inline-flex items-center gap-1">
              <BedDouble className="h-3 w-3 text-faint" />
              {image.analysis.estimatedBedrooms}
            </span>
            <span className="inline-flex items-center gap-1">
              <Bath className="h-3 w-3 text-faint" />
              {image.analysis.estimatedBathrooms}
            </span>
          </div>

          <div className="flex flex-wrap gap-1">
            {image.analysis.detectedFeatures.slice(0, 3).map((f, i) => (
              <span key={i} className="chip border-line bg-raised text-muted">
                {f}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ImageSummary({ images }: { images: UploadedImage[] }) {
  const analyzed = images.filter((i) => i.analysis);
  if (analyzed.length === 0) return null;

  const avg = (pick: (a: ImageAnalysis) => number) =>
    Math.round(analyzed.reduce((s, i) => s + (i.analysis ? pick(i.analysis) : 0), 0) / analyzed.length);
  const avgArea = avg((a) => a.estimatedArea);
  const avgBed = avg((a) => a.estimatedBedrooms);
  const avgBath = avg((a) => a.estimatedBathrooms);
  const avgCond = avg((a) => a.conditionScore);

  const uniqueFeatures = [...new Set(analyzed.flatMap((i) => i.analysis?.detectedFeatures ?? []))];

  return (
    <section className="card p-5 animate-slide-up">
      <div className="flex items-baseline justify-between">
        <h3 className="label">สรุปจาก {analyzed.length} รูป</h3>
        <span className="text-[11px] text-faint">เฉพาะพื้นที่ที่ถูกส่งเข้าโมเดล</span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
        <SummaryStat icon={Maximize} label="พื้นที่เฉลี่ย" value={`${avgArea} ตร.ม.`} emphasis />
        <SummaryStat icon={BedDouble} label="ห้องนอน" value={`${avgBed}`} />
        <SummaryStat icon={Bath} label="ห้องน้ำ" value={`${avgBath}`} />
        <SummaryStat icon={Building2} label="สภาพ" value={`${avgCond}/100`} />
      </dl>

      <div className="mt-4 flex flex-wrap gap-1.5 border-t border-line/70 pt-4">
        {uniqueFeatures.map((f, i) => (
          <span key={i} className="chip border-ok/20 bg-ok-soft text-ok">
            {f}
          </span>
        ))}
      </div>
    </section>
  );
}

function SummaryStat({
  icon: Icon,
  label,
  value,
  emphasis,
}: {
  icon: typeof Maximize;
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-[11px] text-muted">
        <Icon className="h-3 w-3 text-faint" strokeWidth={1.75} />
        {label}
      </dt>
      <dd className={`num mt-0.5 font-medium text-ink ${emphasis ? "text-[20px]" : "text-[15px]"}`}>{value}</dd>
    </div>
  );
}
