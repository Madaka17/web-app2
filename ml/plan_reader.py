"""
Read a house floor plan image into rooms, openings and wall lengths.

A vision model (tokenme, OpenAI-compatible) reads the image once; the page then
lets the owner correct the numbers and prices materials locally. Thinking is
off: with it on, a read reasoned past 130 s and used every token without
answering; off, it takes ~4 s. Reads still stream (SSE), so a slow read cannot
hit Cloudflare's ~125 s idle cutoff (HTTP 524), and run as background jobs that
the page polls (PlanJobs).

The model's answer is untrusted: clean() clamps every number and drops anything
outside the schema. The API key comes from the repo-root .env and never leaves
this process.
"""
from __future__ import annotations

import base64
import binascii
import contextlib
import hashlib
import http.client
import json
import logging
import math
import os
import re
import socket
import tempfile
import threading
import time
import urllib.error
import urllib.request
import uuid
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from pathlib import Path

log = logging.getLogger(__name__)

URL = "https://api.tokenme.limited/api/v1/chat/completions"
MODEL = "deepseek-ai/deepseek-v4.1-flash-1017"
# tokenme's Cloudflare blocks Python's default User-Agent (403, error 1010).
USER_AGENT = "openplot-plan-reader/1.0"
# The JSON answer is ~500 tokens with thinking off; this caps the cost of a runaway reply.
MAX_TOKENS = 4000
# Total budget for one read; the page gives up at 240 s.
TIMEOUT_S = 90
# Socket idle timeout for each recv; the fallback bound if the watchdog cannot reach the socket.
IDLE_S = 30

MIMES = {"image/jpeg", "image/png", "image/webp"}
MAX_IMAGE_BYTES = 8 * 1024 * 1024
ROOM_TYPES = ("living", "bedroom", "kitchen", "bathroom", "other")
# The model guesses rooms too small; with thinking off, a 149 m² floor came back as 84 m².
SCALE_BELOW = 0.7
SCALE_TO = 0.85

PER_IP_PER_DAY = 5
PER_DAY = 200  # about $4 at ~$0.02 a read, under the account's $5 budget
MAX_PENDING = 10
CACHE_SIZE = 200
# Bump CACHE_VERSION whenever PROMPT, clean() or the model changes, so stale reads are dropped.
CACHE_FILE = Path(__file__).resolve().parent / "cache" / "plan_reads.json"
CACHE_VERSION = 1
JOB_TTL_S = 3600
BANGKOK = timezone(timedelta(hours=7))

PROMPT = """อ่านแปลนบ้านนี้ แล้วตอบเป็น JSON อย่างเดียว ไม่มีข้อความอื่น ตามรูปแบบนี้ (เขียน key ตามลำดับนี้):
{"floor_sizes": [{"floor": int, "width_m": number, "length_m": number}],
 "floors": int,
 "rooms": [{"floor": int, "name": str, "type": "living"|"bedroom"|"kitchen"|"bathroom"|"other", "width_m": number, "length_m": number}],
 "doors": int, "windows": int, "exterior_wall_m": number, "interior_wall_m": number}
ขั้นตอน:
1. floor_sizes: อ่านเส้นบอกขนาดรวมของแต่ละชั้นที่เขียนในแปลนก่อน (เช่น 14.30 x 10.40) หน่วยเมตร แปลนหนึ่งรูปอาจมีหลายชั้นวางข้างกัน
2. rooms: ใส่ทุกห้องที่มีชื่อเขียนในแปลน ทุกชั้น รวมห้องเล็ก (ห้องน้ำทุกห้อง, W-I-C/ห้องแต่งตัว, ซักล้าง, ห้องพระ, บันได/โถง) และพื้นที่เปิด (ระเบียง, เฉลียง, ที่จอดรถ) ห้ามเพิ่มห้องที่ไม่มีชื่อในแปลน ใช้ชื่อตามที่เขียนในแปลน
3. ขนาดห้อง: ถ้าแปลนไม่เขียนขนาดห้อง ให้วัดสัดส่วนเทียบกับเส้นบอกขนาดรวมของชั้นนั้น ห้องต้องอยู่ในกรอบของชั้น และพื้นที่ห้องรวมของแต่ละชั้นควรใกล้กับ กว้าง x ยาว ของชั้นนั้น (ลบผนังกับบันไดเล็กน้อย)
- type: living = ห้องนั่งเล่น/รับแขก/ทานอาหาร/โถง, bedroom = ห้องนอน, kitchen = ครัว, bathroom = ห้องน้ำ/ส้วม, other = อื่น ๆ
- doors, windows = นับรวมทุกชั้น
- exterior_wall_m = ความยาวผนังรอบนอกรวมทุกชั้น, interior_wall_m = ความยาวผนังภายในรวมทุกชั้น (ไม่นับผนังรอบนอก)"""


class PlanError(Exception):
    """code: bad_image | config | budget | upstream | timeout | unreadable | limit_ip | limit_day | busy"""

    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


def load_env(path: Path = Path(__file__).resolve().parent.parent / ".env") -> None:
    """KEY=VALUE lines from the repo-root .env; never overrides the real environment."""
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip("'\""))


def decode_image(b64: str, mime: str) -> bytes:
    """Validated image bytes, or PlanError('bad_image')."""
    if mime not in MIMES or not isinstance(b64, str):
        raise PlanError("bad_image")
    try:
        data = base64.b64decode(b64, validate=True)
    except (binascii.Error, ValueError):
        raise PlanError("bad_image")
    magic_ok = (
        (mime == "image/jpeg" and data[:3] == b"\xff\xd8\xff")
        or (mime == "image/png" and data[:8] == b"\x89PNG\r\n\x1a\n")
        or (mime == "image/webp" and data[:4] == b"RIFF" and data[8:12] == b"WEBP")
    )
    if not data or len(data) > MAX_IMAGE_BYTES or not magic_ok:
        raise PlanError("bad_image")
    return data


def _num(v, lo: float, hi: float, default: float = 0.0) -> float:
    try:
        x = float(v)
    except (TypeError, ValueError):
        return default
    if x != x:  # NaN
        return default
    return round(min(max(x, lo), hi), 2)


def _floor_areas(raw: dict) -> dict[int, float]:
    """{floor_number: area_m2} from floor_sizes; malformed entries are skipped."""
    sizes = raw.get("floor_sizes")
    if not isinstance(sizes, list):
        return {}
    areas = {}
    for s in sizes:
        if not isinstance(s, dict):
            continue
        floor = int(_num(s.get("floor"), 1, 5, 0))
        w = _num(s.get("width_m"), 1, 100, 0)
        length = _num(s.get("length_m"), 1, 100, 0)
        if floor and w and length:
            areas[floor] = w * length
    return areas


def clean(raw: dict) -> dict:
    """The model's JSON, clamped to sane ranges and the page's schema."""
    if not isinstance(raw, dict):
        raise PlanError("unreadable")
    found = []  # (floor or None, room); the floor is only used for scaling
    for r in (raw.get("rooms") or [])[:30]:
        if not isinstance(r, dict):
            continue
        kind = r.get("type")
        floor = int(_num(r.get("floor"), 1, 5, 0)) or None
        found.append((floor, {
            "name": str(r.get("name") or "ห้อง")[:40],
            "type": kind if kind in ROOM_TYPES else "other",
            "width_m": _num(r.get("width_m"), 0.5, 30, 0.5),
            "length_m": _num(r.get("length_m"), 0.5, 30, 0.5),
        }))
    if not found:
        raise PlanError("unreadable")
    for floor, area in _floor_areas(raw).items():
        on_floor = [room for f, room in found if f == floor]
        covered = sum(room["width_m"] * room["length_m"] for room in on_floor)
        # shortcut: assumes rooms fill the floor's bounding box; an L-shaped house comes out too big. Upgrade by asking the model for room positions.
        if on_floor and covered < SCALE_BELOW * area:
            k = math.sqrt(SCALE_TO * area / covered)
            for room in on_floor:
                room["width_m"] = _num(room["width_m"] * k, 0.5, 30, 0.5)
                room["length_m"] = _num(room["length_m"] * k, 0.5, 30, 0.5)
    rooms = [room for _, room in found]
    return {
        "floors": int(_num(raw.get("floors"), 1, 5, 1)),
        "rooms": rooms,
        "doors": int(_num(raw.get("doors"), 0, 40)),
        "windows": int(_num(raw.get("windows"), 0, 60)),
        "exterior_wall_m": _num(raw.get("exterior_wall_m"), 0, 500),
        "interior_wall_m": _num(raw.get("interior_wall_m"), 0, 500),
    }


def parse(text: str) -> dict:
    """First {...} block in the reply, cleaned. Prose around it is ignored."""
    m = re.search(r"\{.*\}", text or "", re.S)
    if not m:
        raise PlanError("unreadable")
    try:
        return clean(json.loads(m.group(0)))
    except json.JSONDecodeError:
        raise PlanError("unreadable")


def _expire(resp, expired: threading.Event) -> None:
    """Watchdog: mark the read as past its deadline and wake a thread blocked in recv."""
    expired.set()
    try:
        # shutdown, not close: only shutdown wakes a thread blocked in recv.
        resp.fp.raw._sock.shutdown(socket.SHUT_RDWR)
    # shortcut: relies on http.client internals (fp.raw._sock); if missing, only IDLE_S bounds a stall.
    except Exception:
        pass


def read_plan(image: bytes, mime: str) -> dict:
    """One streamed model call. Never retried: a failed call may still be billed."""
    key = os.environ.get("TOKENME_API_KEY", "").strip()
    if not key:
        raise PlanError("config")
    b64 = base64.b64encode(image).decode()
    body = json.dumps({
        "model": MODEL,
        "temperature": 0,
        "max_tokens": MAX_TOKENS,
        "stream": True,
        # With thinking on, the model spent all 20k tokens reasoning and answered nothing.
        "chat_template_kwargs": {"thinking": False},
        "messages": [{"role": "user", "content": [
            {"type": "text", "text": PROMPT},
            {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}},
        ]}],
    }).encode()
    req = urllib.request.Request(URL, body, {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
    })
    start = time.monotonic()
    parts: list[str] = []
    data_lines = 0
    finish_reason = None
    expired = threading.Event()
    timer = None
    try:
        with urllib.request.urlopen(req, timeout=IDLE_S) as r:
            timer = threading.Timer(TIMEOUT_S - (time.monotonic() - start), _expire, (r, expired))
            timer.daemon = True
            timer.start()
            for raw in r:
                if time.monotonic() - start > TIMEOUT_S:
                    log.warning("plan read: deadline after %.0fs", time.monotonic() - start)
                    raise PlanError("timeout")
                line = raw.decode("utf-8").strip()
                if not line or not line.startswith("data:"):
                    continue
                data_lines += 1
                payload = line[len("data:"):].strip()
                if payload == "[DONE]":
                    break
                chunk = json.loads(payload)
                if not isinstance(chunk, dict):
                    continue
                error = chunk.get("error")
                if error:
                    log.warning("plan read: error in stream: %s", str(error)[:200])
                    codes = {str(error.get(k)) for k in ("code", "status")} if isinstance(error, dict) else set()
                    raise PlanError("budget" if codes & {"402", "429"} else "upstream")
                choices = chunk.get("choices")
                if not isinstance(choices, list) or not choices or not isinstance(choices[0], dict):
                    continue
                if choices[0].get("finish_reason") is not None:
                    finish_reason = choices[0]["finish_reason"]
                delta = choices[0].get("delta")
                if not isinstance(delta, dict):
                    continue
                content = delta.get("content")
                if isinstance(content, str):
                    parts.append(content)  # reasoning_content is ignored
    except PlanError:
        raise
    except urllib.error.HTTPError as e:
        try:
            detail = e.read().decode("utf-8", errors="replace")
        except Exception:
            detail = ""
        log.warning("plan read: HTTP %s after %.0fs: %s", e.code, time.monotonic() - start, detail[:200])
        raise PlanError("budget" if e.code in (402, 429) else "upstream")
    except (socket.timeout, TimeoutError) as e:
        log.warning("plan read: %s after %.0fs", type(e).__name__, time.monotonic() - start)
        raise PlanError("timeout")
    except (urllib.error.URLError, OSError, http.client.HTTPException, json.JSONDecodeError, UnicodeDecodeError) as e:
        log.warning("plan read: %s after %.0fs", type(e).__name__, time.monotonic() - start)
        raise PlanError("upstream")
    finally:
        if timer is not None:
            timer.cancel()
        if expired.is_set():
            # Any error raised here was likely caused by the watchdog's shutdown; the deadline is the real cause.
            log.warning("plan read: total deadline %.0fs hit", TIMEOUT_S)
            raise PlanError("timeout")
    text = "".join(parts)
    if not text:
        log.warning("plan read: no content after %.0fs (finish_reason=%s, %d data lines)",
                    time.monotonic() - start, finish_reason, data_lines)
    else:
        log.info("plan read: ok in %.0fs, %d chars", time.monotonic() - start, len(text))
    return parse(text)  # empty text raises PlanError("unreadable")


class PlanJobs:
    """Background reads with a per-IP and a site-wide daily cap and a result cache.

    shortcut: the cache persists to ml/cache/plan_reads.json, but limits and jobs still reset on restart; move to sqlite if abuse shows up.
    """

    def __init__(self, reader=read_plan, workers: int = 2, now=time.time, cache_file: Path | None = CACHE_FILE):
        self._reader = reader
        self._now = now
        self._pool = ThreadPoolExecutor(max_workers=workers)
        self._lock = threading.Lock()
        self._jobs: dict[str, dict] = {}
        self._cache: OrderedDict[str, dict] = OrderedDict()
        self._cache_file = cache_file  # None keeps the cache in memory only
        self._load_cache()
        self._per_ip: dict[tuple[str, str], int] = {}
        self._per_day: dict[str, int] = {}

    def _day(self) -> str:
        return datetime.fromtimestamp(self._now(), BANGKOK).strftime("%Y-%m-%d")

    def _load_cache(self) -> None:
        """Fill the cache from disk. A missing file is silent; anything bad starts empty."""
        if self._cache_file is None:
            return
        try:
            data = json.loads(self._cache_file.read_text(encoding="utf-8"))
            if not isinstance(data, dict) or data.get("version") != CACHE_VERSION:
                raise ValueError(f"not version {CACHE_VERSION}")
            if not isinstance(data.get("reads"), list):
                raise ValueError("reads is not a list")
            reads = [(digest, result) for digest, result in data["reads"]]
            if not all(isinstance(d, str) and isinstance(r, dict) for d, r in reads):
                raise ValueError("bad read entry")
        except FileNotFoundError:
            return
        except (OSError, ValueError, TypeError) as e:
            log.warning("plan cache %s ignored: %s", self._cache_file, e)
            return
        for digest, result in reads[-CACHE_SIZE:]:  # oldest first, so the newest stay
            self._cache[digest] = result

    def _save_cache(self) -> None:
        """Write the whole cache atomically. Caller holds self._lock. A failure is logged, never raised."""
        if self._cache_file is None:
            return
        body = json.dumps({"version": CACHE_VERSION, "reads": [[d, r] for d, r in self._cache.items()]},
                          ensure_ascii=False)
        tmp = None
        try:
            self._cache_file.parent.mkdir(parents=True, exist_ok=True)
            fd, tmp = tempfile.mkstemp(dir=self._cache_file.parent, suffix=".tmp")
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                f.write(body)
            os.replace(tmp, self._cache_file)
        except OSError as e:
            log.warning("plan cache save to %s failed: %s", self._cache_file, e)
            if tmp is not None:
                with contextlib.suppress(OSError):
                    os.unlink(tmp)

    def submit(self, image: bytes, mime: str, client: str) -> dict:
        digest = hashlib.sha256(image).hexdigest()
        with self._lock:
            now = self._now()
            for jid in [j for j, v in self._jobs.items() if now - v["created"] > JOB_TTL_S]:
                del self._jobs[jid]
            job_id = uuid.uuid4().hex
            if digest in self._cache:
                self._cache.move_to_end(digest)
                self._jobs[job_id] = {"status": "done", "result": self._cache[digest], "created": now}
                return self.get(job_id)
            day = self._day()
            if self._per_ip.get((day, client), 0) >= PER_IP_PER_DAY:
                raise PlanError("limit_ip")
            if self._per_day.get(day, 0) >= PER_DAY:
                raise PlanError("limit_day")
            if sum(1 for v in self._jobs.values() if v["status"] == "pending") >= MAX_PENDING:
                raise PlanError("busy")
            self._per_ip[(day, client)] = self._per_ip.get((day, client), 0) + 1
            self._per_day[day] = self._per_day.get(day, 0) + 1
            self._jobs[job_id] = {"status": "pending", "created": now}
        self._pool.submit(self._run, job_id, digest, image, mime)
        return self.get(job_id)

    def _run(self, job_id: str, digest: str, image: bytes, mime: str) -> None:
        try:
            result = self._reader(image, mime)
        except PlanError as e:
            update = {"status": "error", "code": e.code}
        except Exception:  # a bug must not leave the page polling forever
            log.exception("plan job %s crashed", job_id)
            update = {"status": "error", "code": "upstream"}
        else:
            update = {"status": "done", "result": result}
            with self._lock:
                self._cache[digest] = result
                while len(self._cache) > CACHE_SIZE:
                    self._cache.popitem(last=False)
                self._save_cache()  # under the lock so a slower write cannot overwrite a newer snapshot
        with self._lock:
            if job_id in self._jobs:
                self._jobs[job_id].update(update)

    def get(self, job_id: str) -> dict | None:
        job = self._jobs.get(job_id)
        if job is None:
            return None
        out = {"job_id": job_id, "status": job["status"]}
        if "result" in job:
            out["result"] = job["result"]
        if "code" in job:
            out["code"] = job["code"]
        return out
