# House Material Cost Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new page, `/build-cost`. A homeowner drops in a floor plan image. A vision model reads it into rooms and wall lengths. The homeowner corrects those numbers and picks materials per category. The page then lists every material with its quantity, unit, unit price and baht total. The model is called once per plan, so changing materials recalculates instantly and costs nothing.

**Architecture:**
- `ml/plan_reader.py` reads the plan. It calls the tokenme OpenAI-compatible API with stdlib `urllib`. It validates the JSON the model returns and clamps it to sane ranges.
- `api.py` serves the reader as an async job. Reads take 100–110 s and the public site sits behind a Cloudflare tunnel, whose origin timeout is 100 s, so a single blocking request would fail with 524.
- All quantity and cost maths is a pure TypeScript module, `src/lib/buildCost.ts`, fed by one data file, `src/data/buildCost.json`. That file holds the prices and the quantity rules, each with its source.
- The page is `src/pages/BuildCostPage.jsx`.

**Tech Stack:**
- Backend: Flask (existing) and Python stdlib `urllib`, `hashlib`, `threading` and `concurrent.futures`. Do not add a Python dependency: no `requests`, `python-dotenv` or Pillow.
- Frontend: React and Tailwind (existing), plus the browser canvas for downscaling. Do not add an npm dependency.
- Model: `deepseek-ai/deepseek-v4.1-flash-1017` through `https://api.tokenme.limited/api/v1/chat/completions`.

**Spec:** The user's answers on 2026-11-26:
- The users are homeowners. Anyone can use the page, because the site is public through the tunnel.
- Residential houses only for now.
- The homeowner uploads a plan, then chooses the materials they want, and the page calculates material cost.
- **Materials only. No labour.**
- Prices come from public sources.

## Findings this plan relies on (measured 2026-11-26)

- **Model reads:** On a clean synthetic plan (10 × 8 m, 5 rooms, 5 doors, 5 windows, labelled dimensions), DeepSeek got every room, the area, the doors and the wall lengths right on 2 of 2 runs. It counted 6 windows instead of 5 on one run.
  - Each read took 103–110 s and about 17k tokens, about 16k of them reasoning.
  - The cost was about $0.02 per read, about $1.2 per million tokens on the account's plan.
  - The test script and image are in the session scratchpad. They are not in the repo.
- **Token budget:** With `max_tokens` at the default 4096, reasoning used the whole budget and the answer was empty. Use `max_tokens: 20000`.
- **User-Agent:** tokenme's Cloudflare blocks Python's default User-Agent with HTTP 403, error 1010. Send `User-Agent: openplot-plan-reader/1.0`.
- **Qwen route:** `unsloth/qwen3.8-27b-nvfp4` is listed as image-capable but returned 503 `route_unavailable`. Do not use it. Do not retry a 503 either, because the dashboard may bill failed calls (unconfirmed).
- **Account budgets:** $5, $20 and $40, all applying together. At $0.02 a read, the $5 budget (it appears to be daily) allows about 250 reads.
- **Price source:** The Ministry of Commerce publishes monthly average material prices per province. The publisher is สำนักงานนโยบายและยุทธศาสตร์การค้า (สนค., formerly สำนักดัชนีเศรษฐกิจการค้า).
  - The table is titled "ราคาสินค้าเฉลี่ยวัสดุก่อสร้าง (ราคาเงินสด ไม่รวมภาษีมูลค่าเพิ่ม ไม่รวมค่าขนส่ง) จังหวัด … เดือน …".
  - A Dec 2566 Ayutthaya copy (uploads.tpso.go.th) has about 270 items with baht per unit. The page footer names `www.indexpr.moc.go.th/PRICE_PRESENT/table_month_regionCsi.asp`, which timed out from here on 2026-11-26.
  - Covered: ready-mix concrete, อิฐมอญ, concrete block, SR24 and SD40 rebar, Portland and mixed cement, sand, stone, PVC pipe, VAF wire, concrete roof tiles and ridges, ลอนคู่, gypsum board, plywood, glass, ceramic floor and wall tiles, timber, interior, exterior and primer paint, wooden doors and windows, hinges, faucets, washbasin, switches and sockets.
  - **Not seen** in that copy: อิฐมวลเบา, แกรนิตโต้, เมทัลชีท, laminate or vinyl flooring, UPVC or aluminium windows, toilet.
  - A Bangkok edition for Aug 2569 exists. An aggregator (yotathai.com) republishes it; use that only to cross-check, never as the cited source.

## Global Constraints

- **Secrets:** The key lives in repo-root `.env` as `TOKENME_API_KEY`, which is gitignored. `plan_reader.py` loads `.env` itself with a few stdlib lines and never overrides a variable already set. Never log, print or return the key. Never log image bytes.
- **Inputs:** JPEG, PNG or WebP only, at most 8 MB after base64 decode. The client downscales to a long edge of 1600 px, JPEG quality 0.85, before upload. PDF is out of scope for v1; the page tells the user to upload a screenshot instead.
- **Scope v1:** Single-storey plans. If the model reports `floors > 1`, the review step shows a notice that v1 prices one floor and lets the user continue.
- **Not included, stated on the page:** labour, roof frame, ceiling frame, electrical and plumbing systems, built-ins, site work, transport and permits.
- **Prices:** All prices are the official ex-VAT figure, and the result adds a separate VAT 7% line. Every price row stores `source_url`, `month` (YYYY-MM) and `province`. The page shows the price month.
- **No retail scraping:** A material option with no official price is left out of v1. Do not scrape retailer sites.
- **Quantity rules:** Every quantity coefficient lives in `buildCost.json` with a non-empty `source`. A test enforces this. Values marked *unverified* below are starting points. Task 1 must confirm each against a cited public source, or replace it.
- **Python:** Run as the venv's python with `-X utf8` from `ml/`. On Windows that is `.venv/Scripts/python.exe`, on macOS `.venv/bin/python`.
- **Servers:** Do not start, stop or kill servers. The controller restarts the API.
- **UI strings:** New strings need i18n keys in th, en and zh.

## Review Focus

1. **Key safety:** The key never leaves the server. Grep the built `dist/` for `tm_live` and for the key name and expect no hits. The key and image bytes never reach logs.
2. **Abuse limits:**
   - At most 5 reads per client IP per day. The IP is `CF-Connecting-IP` when present, else `remote_addr`.
   - At most 200 reads per day server-wide.
   - A repeat of the same image (sha256) is served from cache and does not count. The limits answer 429 with a reason code the page translates.
3. **Model output is untrusted:**
   - Every number is clamped. Room sides are 0.5–30 m. Rooms number at most 30, doors 0–40 and windows 0–60. Walls are 0–500 m.
   - Unknown room types become `other`.
   - Unparseable output becomes a 502 with code `unreadable`, never a crash.
4. **No timeout through the tunnel:** `POST` returns within 1 s, and the page polls `GET`.
5. **Maths:** The worked example in Task 2 matches to the baht.
6. **Honesty on the page:** The page states the price month, the ex-VAT source, the "not included" list and "ประมาณการ ไม่ใช่ใบเสนอราคา".

---

### Task 1: Price and rule data (`src/data/buildCost.json`)

**Files:** Create `src/data/buildCost.json` and `src/lib/__tests__/buildCostData.test.ts`.

- [ ] **Step 1: Get the latest Bangkok price table.**
  - Try `www.indexpr.moc.go.th` and `tpso.go.th` for the "ราคาสินค้าเฉลี่ยวัสดุก่อสร้าง จังหวัด กรุงเทพมหานคร" table of the latest published month.
  - Record the exact URL and month.
  - If the official site is unreachable, stop and report. Do not substitute the aggregator.
- [ ] **Step 2: Write `prices`.** Each row has `id`, `name_th`, `unit_th`, `price` (ex-VAT baht), `source_url`, `month` and `province`. Use only items the options below need. Copy the official item wording.
- [ ] **Step 3: Write `options`.** Use only items with a price from Step 2, and drop an option whose item is missing. The categories and starting options are:
  - `wall`: อิฐมอญ, คอนกรีตบล็อก, and อิฐมวลเบา only if Bangkok lists it.
  - `plaster`: cement and sand mortar.
  - `paint`: interior and exterior topcoat with primer, at 2 grades if 2 brands are listed.
  - `floor`: ceramic floor tile in 2 sizes. The bathroom floor is always ceramic.
  - `bath_wall`: ceramic wall tile to 2.0 m height.
  - `ceiling`: gypsum board.
  - `roof`: concrete tile, ลอนคู่, and เมทัลชีท only if listed.
  - `door`: plywood door, interior or exterior grade.
  - `window`: wooden window. Add glass only if a window option needs it.
  - `sanitary`: washbasin and faucet, and a toilet only if listed.
  - `structure`: ready-mix concrete 210 ksc and SD40 rebar, estimated from floor area. This category is not user-selectable.
- [ ] **Step 4: Write `rules`.** Each rule has `id`, `value`, `unit` and `source`. Starting values:
  - `brick_red_per_sqm` = 138, *unverified*, commonly quoted 130–140.
  - `block_per_sqm` = 12.5, from geometry: 1 / (0.20 × 0.40 m including the joint).
  - `aac_per_sqm` = 8.33, from geometry: 1 / (0.20 × 0.60).
  - Mortar per sqm for laying and for plaster (1.5 cm per face), and its cement and sand split: *unverified*. Cite a construction-estimating handbook. The Comptroller General's construction price-estimation guidance is the first place to look.
  - `paint_sqm_per_gallon_coat` = 30, *unverified*. Use the coverage printed on the chosen brand's data sheet. Use 2 topcoats and 1 primer coat.
  - `gypsum_sqm_per_sheet` = 2.88, from geometry: 1.2 × 2.4.
  - `roof_tile_concrete_per_sqm` and `roof_lonkhu_per_sqm`: *unverified*. Use the manufacturer's laying guide.
  - `structure_concrete_m3_per_sqm` and `rebar_kg_per_m3`: *unverified*. Label these "ประมาณการคร่าว ๆ" on the page.
  - Waste factors per category, *unverified*: tiles 1.05, bricks and blocks 1.05, mortar 1.10, paint 1.00, gypsum 1.05, roof 1.05.
  - Defaults: `wall_height_m` = 2.8, `door_sqm` = 1.6, `window_sqm` = 1.1, `roof_overhang_m` = 1.0, and roof pitch 30° for tile and 15° for sheet.
- [ ] **Step 5: Test the data.** In `buildCostData.test.ts`, assert:
  - Every price has a positive `price`, an `http(s)` `source_url` and a `YYYY-MM` `month`.
  - Every option's item ids exist in `prices`.
  - Every rule has a non-empty `source`.
  - Run `npx vitest run src/lib/__tests__/buildCostData.test.ts` and expect PASS.
- [ ] **Step 6: Commit** `feat: material prices and quantity rules for the build-cost page`.

### Task 2: Calculator (`src/lib/buildCost.ts`)

**Files:** Create `src/lib/buildCost.ts` and `src/lib/__tests__/buildCost.test.ts`.

- [ ] **Step 1: Types.**
  - `Plan` = `{ rooms: {name, type: 'living'|'bedroom'|'kitchen'|'bathroom'|'other', width_m, length_m}[], doors, windows, exterior_wall_m, interior_wall_m, wall_height_m }`.
  - `Selection` maps a category to an option id, plus `floorByRoom?: Record<index, optionId>`.
  - `Line` = `{ category, item_id, name_th, qty, unit_th, unit_price, total }`.
- [ ] **Step 2: Quantities.**
  - `floorArea = Σ w×l`.
  - `openings = doors×door_sqm + windows×window_sqm`.
  - `extWall = exterior_wall_m × h − openings_on_exterior`. v1 puts all windows and 1 door on the exterior.
  - `intWall = interior_wall_m × h − (doors−1)×door_sqm`, clamped ≥ 0.
  - Paint and plaster area is `extWall×2 + intWall×2`. Exterior paint covers `extWall`; interior paint covers the rest.
  - `roofArea = (floorArea + exterior_wall_m×o + 4o²) / cos(pitch)`.
  - The bathroom wall tile covers the bathroom perimeter × 2.0 m − 1 door.
- [ ] **Step 3: Lines.**
  - `qty = ceil(rawQty × waste / packSize) × packSize` when the item sells in packs (bags, sheets, cans). Otherwise round to 2 dp.
  - `total = qty × unit_price`, rounded to the baht.
  - Return `{ lines, subtotal, vat: round(subtotal × 0.07), total, priceMonth }`.
- [ ] **Step 4: Tests.**
  - The worked example uses the 10 × 8 m test plan with the defaults. Assert the floor area is 80, the wall areas follow the formulas above by hand, and each line's qty and total equal hand-computed values. Put the hand computation in a comment.
  - Changing `wall` from อิฐมอญ to concrete block changes only the wall lines.
  - Clamp checks: zero doors, zero windows and a negative computed wall area each yield no NaN and no negative quantity.
  - Run `npx vitest run src/lib/__tests__/buildCost.test.ts` and expect PASS.
- [ ] **Step 5: Commit** `feat: material quantity and cost calculator`.

### Task 3: Plan reader API (`ml/plan_reader.py` and endpoints)

**Files:** Create `ml/plan_reader.py` and `ml/test_plan_reader.py`. Modify `ml/api.py`.

- [ ] **Step 1: `plan_reader.py`.**
  - `load_env()` reads `../.env` `KEY=VALUE` lines, skips `#` lines, and calls `os.environ.setdefault`.
  - `read_plan(image_bytes, mime) -> dict` builds the prompt. The prompt is the one from the scratchpad test, plus a `type` per room from the enum, plus `floors`.
  - It POSTs with `temperature: 0`, `max_tokens: 20000`, the User-Agent above and a 180 s timeout.
  - It extracts the first `{…}` from the reply, then calls `clean(raw) -> dict`, which clamps per Review Focus 3.
  - Errors raise `PlanError(code)` with code `config` (no key), `upstream` (non-200, including 402/429 from tokenme, mapped to `budget`), `timeout` or `unreadable`.
- [ ] **Step 2: Endpoints in `api.py`.**
  - `POST /api/plan/read`:
    - Takes `{image: base64, mime}`.
    - Validates the MIME type and the size. A bad image gets a 400.
    - Computes the sha256. A cache hit returns `{job_id, status:'done', result}`.
    - Otherwise it checks the per-IP and global daily limits (429 `{code:'limit_ip'|'limit_day'}`).
    - It submits to a `ThreadPoolExecutor(max_workers=2)` and returns `{job_id, status:'pending'}` at once.
  - `GET /api/plan/read/<job_id>` returns `pending`, `done` with `result`, or `error` with `code`.
  - Jobs and cache are in-memory dicts guarded by a lock. Cap the cache at 200 entries and expire jobs after 1 hour. Mark it `# shortcut: limits and cache reset on API restart, move to sqlite if abuse shows up`.
  - Add both endpoints to the module docstring.
- [ ] **Step 3: Tests.**
  - Monkeypatch `urllib.request.urlopen` and never call the network.
  - Cover: a valid reply parses and clamps; a reply wrapped in prose still parses; garbage gives `unreadable`; an HTTP 403 or 503 gives `upstream`; a 402 gives `budget`; a missing key gives `config`.
  - Cover the limit counter: the sixth read from one IP in a day gets 429, and a cached repeat is not counted.
  - Run `-m pytest test_plan_reader.py` and expect PASS.
- [ ] **Step 4: One live smoke test** with the scratchpad plan image, run by the controller, who owns the key. Record the seconds taken and the parsed result in the task report. Do not commit the image.
- [ ] **Step 5: Commit** `feat(api): async floor-plan reader with limits and cache`.

### Task 4: Page (`/build-cost`)

**Files:**
- Create `src/pages/BuildCostPage.jsx` and `src/lib/planApi.ts`.
- Modify `src/App.jsx` (route), `src/components/Header.jsx` (one nav link next to the map), `src/i18n.jsx` (th, en, zh) and `src/pages/DocPages.jsx` (privacy: plan images go to tokenme for reading and are not stored by us).

- [ ] **Step 1: `planApi.ts`.**
  - `downscale(file) -> {base64, mime}` uses canvas with a 1600 px long edge and JPEG 0.85.
  - `readPlan(file, onTick) -> Promise<Plan>` POSTs, then polls every 3 s for up to 240 s and maps error codes to i18n keys.
  - Abort on unmount with an `AbortController`.
- [ ] **Step 2: Step 1 UI, upload.**
  - A drop zone or file input, with the note that PDF should be sent as a screenshot.
  - A "กรอกเอง" button that skips the model and starts with one empty room.
  - While reading, show elapsed seconds and "ใช้เวลาประมาณ 2 นาที".
- [ ] **Step 3: Step 2 UI, review.**
  - An editable rooms table (name, type select, width, length) with add and remove buttons.
  - Inputs for doors, windows, exterior and interior wall lengths and wall height.
  - Show the computed floor area live.
  - Show the `floors > 1` notice when it applies.
  - Highlight "ตรวจตัวเลขก่อน AI อ่านผิดได้".
- [ ] **Step 4: Step 3 UI, materials.**
  - A preset row: ประหยัด / มาตรฐาน / พรีเมียม. It only sets defaults, and each preset maps to option ids in `buildCost.json`.
  - One card per category with its options and unit prices.
  - The floor option can be overridden per room. A bathroom is locked to ceramic.
- [ ] **Step 5: Step 4 UI, result.**
  - A lines table grouped by category, then subtotal, VAT 7% and total.
  - The price month and source link.
  - The "not included" list and "ประมาณการ ไม่ใช่ใบเสนอราคา".
  - A print button (`window.print()` with a print stylesheet hiding the controls) and a CSV download built in-page, UTF-8 with BOM so Excel shows Thai.
  - The result updates instantly as materials change.
- [ ] **Step 6: Verify.** Run `npm run lint && npm test && npm run build`. Then the controller runs the app and walks through: upload the test plan, check the numbers, switch materials, compare the totals with Task 2's example, print preview and download the CSV.
- [ ] **Step 7: Commit** `feat: build-cost page for floor-plan material estimates`.

## Open questions for later (not v1)

- Multi-storey plans: one read per floor, plus a slab and stair allowance.
- Roof frame and ceiling frame materials, once a priced steel-section rule is sourced.
- Provinces other than Bangkok: select the province and load that province's monthly table.
- Real-plan accuracy: test 3–5 real Thai plans, scanned, photographed and hand-drawn, before announcing the page.
