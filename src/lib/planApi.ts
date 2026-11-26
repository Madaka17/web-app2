// Floor-plan reading for the /build-cost page: shrink the image in the browser,
// start a read job on the API (ml/plan_reader.py) and poll it. A read takes about
// 10 seconds; it stays a polled job so a slow read never hits the tunnel's 100 s limit.
import type { Plan, RoomType } from "./buildCost";

const BASE = import.meta.env.VITE_API_URL ?? "";
const LONG_EDGE = 1600;
const POLL_MS = 3000;
const GIVE_UP_MS = 240_000;

export interface ReadPlan extends Plan {
  floors: number;
}

/** Error code from the API, or "network". The page maps it to a message. */
export class PlanReadError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

/** JPEG, long edge at most 1600 px, as base64 without the data: prefix. */
export async function downscale(file: File): Promise<{ image: string; mime: string }> {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new PlanReadError("bad_image");
  });
  const scale = Math.min(1, LONG_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new PlanReadError("bad_image");
  // White under transparent PNG plans, which JPEG would otherwise turn black.
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const url = canvas.toDataURL("image/jpeg", 0.85);
  return { image: url.slice(url.indexOf(",") + 1), mime: "image/jpeg" };
}

async function call(path: string, init: RequestInit): Promise<{ status: string; job_id?: string; result?: ReadPlan; code?: string }> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, init);
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new PlanReadError("network");
  }
  const body = await res.json().catch(() => ({ status: "error", code: "upstream" }));
  if (!res.ok || body.status === "error") throw new PlanReadError(body.code ?? "upstream");
  return body;
}

const ROOM_TYPES: RoomType[] = ["living", "bedroom", "kitchen", "bathroom", "other"];

/** Reads the plan; onTick gets the elapsed seconds while waiting. */
export async function readPlan(file: File, signal: AbortSignal, onTick: (seconds: number) => void): Promise<ReadPlan> {
  const payload = await downscale(file);
  const started = Date.now();
  let job = await call("/api/plan/read", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });
  while (job.status === "pending") {
    if (Date.now() - started > GIVE_UP_MS) throw new PlanReadError("timeout");
    await new Promise((resolve, reject) => {
      const t = setTimeout(resolve, POLL_MS);
      signal.addEventListener("abort", () => {
        clearTimeout(t);
        reject(new DOMException("aborted", "AbortError"));
      });
    });
    onTick(Math.round((Date.now() - started) / 1000));
    job = await call(`/api/plan/read/${job.job_id}`, { signal });
  }
  const r = job.result;
  if (!r) throw new PlanReadError("unreadable");
  // The API already clamps; keep the page safe from an older API too.
  return {
    ...r,
    rooms: r.rooms.map((room) => ({ ...room, type: ROOM_TYPES.includes(room.type) ? room.type : "other" })),
  };
}
