# OpenPlot Merge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the OpenPlot map site the frontend of web-app2, with the price model as a native side panel and the real listing and project data as map pins.

**Architecture:** The React frontend in this repo is replaced by OpenPlot (`../app/`, JSX + Tailwind + Leaflet + react-router). `ml/`, `Data/` and `public/listings.json` stay. A pure TypeScript layer (`mapData.ts`, `priceForm.ts`) holds data and form logic under vitest. `MapCanvas` draws real tiles and real pins. `PricePanel` docks left of the map on desktop and is a bottom sheet on phones, and it calls the existing Flask API through `/api`.

**Tech Stack:** React 18, Vite 5, Tailwind 3, Leaflet 1.9, react-router 6, lucide-react, vitest; Flask + CatBoost/LightGBM/XGBoost (unchanged).

**Spec:** The user's request, restated: OpenPlot is the base template; the price prediction feature becomes native, on the side; the data comes along to be pinned on the map.

## Global Constraints

- Source of the template: `../app/` (read only, never edited). Work only inside `web-app2/`, branch `merge-openplot`. Never push.
- OpenPlot's look is the authority: red `#DC2626` panel headers, white surfaces, `border-[#E0E0E0]`, `rounded-xl`, Tailwind tokens from its config. None of web-app2's space theme survives.
- `ml/` is not modified.
- Every panel and map string goes through `t()` with `th`, `en` and `zh` values in `src/i18n.jsx`.
- Scraped text (titles, names) is untrusted: anything placed in a Leaflet popup HTML string passes `escapeHtml`; links pass `safeHttpUrl`.
- The panel always shows the notice that the figure is based on asking prices and is not an official appraisal.
- Pins come only from `public/listings.json` and `public/projects.json`. The invented `LAND_POINTS` / `FUTURE_POINTS` and invented stats (`7,427` users, project value, investment) are removed.

## Review Focus

- A map click far outside Bangkok and its ring provinces: the API would snap to the nearest known sub-district and return a confident wrong price. Expect no request and a clear out-of-coverage message. Test: `isInCoverage` in Task 4.
- A listing title or project name containing HTML: expect literal text in the popup. Test: `escapeHtml` in Task 2.
- A listing whose type the model cannot price (shop house, office, warehouse): expect the form to keep its current type rather than guess silently, with location and area still filled. Test: `targetPatch` in Task 4.
- A land listing with `area_sqm: null` but `land_sqwa` set: expect area = sq.wa x 4. Test: `normalizeListing` in Task 2.
- A filter that matches nothing, or min above max: expect no pins, zero stats and no crash. Test: `applyFilter` and `summarize` in Task 2.

---

### Task 1: Replace the frontend with OpenPlot

**Files:**
- Delete: `src/App.tsx`, `src/main.tsx`, `src/index.css`, `src/context/`, `src/components/`, and from `src/lib/`: `download.ts`, `featureLabels.ts`, `grades.ts`, `mapTiles.ts`, `projection.ts`, `useAnimatedNumber.ts`, `useApi.ts`, `useHashRoute.ts`, `usedHomes.ts`, with their tests (`download`, `featureLabels`, `projection`).
- Delete: `docs/superpowers/plans/2026-10-16-space-horizon-ui.md`, `tsconfig.app.tsbuildinfo`, `tsconfig.node.tsbuildinfo`.
- Keep: `src/lib/{api,types,locations,defaults,growth,prediction}.ts` and tests `format.test.ts`, `locations.test.ts`.
- Copy from `../app/`: `src/App.jsx`, `src/main.jsx`, `src/index.css`, `src/art.js`, `src/data.js`, `src/i18n.jsx`, `src/modeWashes.js`, `src/components/`, `src/pages/`, `scripts/postbuild.mjs`, `index.html`, `tailwind.config.js`, `postcss.config.js`.
- Modify: `package.json`, `vite.config.ts`, `tsconfig.app.json`, `eslint.config.js` (ignore `src/**/*.jsx` is not needed: its `files` is already `**/*.{ts,tsx}`), `.gitignore` (add `*.tsbuildinfo`).

**Interfaces:**
- Produces: `npm run build`, `npm run dev`, `npm test`, `npm run typecheck`, the `@/` alias to `src/`, and `/api` proxied to `http://127.0.0.1:3030`.

- [ ] **Step 1: Delete and copy the files listed above.** Copy with `cp`, preserving bytes.
- [ ] **Step 2: Merge `package.json`.** Name `openplot-map`. Scripts: `dev`, `build` = `vite build && node scripts/postbuild.mjs`, `lint`, `preview`, `typecheck`, `test`, `test:watch`. Dependencies: `@fontsource/kanit ^5.0.0`, `@fontsource/montserrat ^5.3.0`, `leaflet ^1.9.4`, `lucide-react ^0.460.0`, `react ^18.3.1`, `react-dom ^18.3.1`, `react-router-dom ^6.28.0`. Drop `maplibre-gl` and `react-leaflet`. Keep web-app2's devDependencies. Regenerate the lockfile with `npm install`.
- [ ] **Step 3: Update `vite.config.ts`.** Keep `modelApi()`, the alias, `server.host` and `server.proxy` unchanged. Set `manualChunks` to `{ leaflet: ['leaflet'] }`. Remove `optimizeDeps`.
- [ ] **Step 4: Add `"types": ["vitest/globals"]` only if a kept test needs it;** otherwise leave `tsconfig.app.json` alone.
- [ ] **Step 5: Verify.** Run `npm run typecheck && npm test && npm run build`. Expected: all pass, and `dist/map/index.html` exists. Then `npm run dev` and load `http://127.0.0.1:5173/map`: the OpenPlot mode picker renders, still with invented pins. (The `modelApi` plugin may start the API here; stop the server when done. If the Python side fails, that is out of scope for this task.)
- [ ] **Step 6: Commit** `feat: replace frontend with OpenPlot template`.

---

### Task 2: Map data layer

**Files:**
- Create: `src/lib/mapData.ts`, `src/lib/__tests__/mapData.test.ts`, `Data/build_map_projects.py`, `public/projects.json` (generated)

**Interfaces:**
- Produces, from `src/lib/mapData.ts`:

```ts
export type TypeGroup = 'condo' | 'house' | 'townhome' | 'land' | 'other';
export type ProjectKind = 'village' | 'condo';
export interface MapListing {
  kind: 'listing'; id: string; url: string; title: string; rawType: string; group: TypeGroup;
  price: number; area: number | null; bedrooms: number | null; bathrooms: number | null;
  subdistrict: string; district: string; province: string; lat: number; lng: number; image: string;
}
export interface MapProject {
  kind: 'project'; id: string; name: string; projectKind: ProjectKind; grade: string; n: number;
  ppsqm: number; price: number; area: number;
  subdistrict: string; district: string; province: string; lat: number; lng: number;
}
export type MapPoint = MapListing | MapProject;
export interface MapFilter { group: string; sizeMin: string; sizeMax: string; priceMin: string; priceMax: string }
export const EMPTY_FILTER: MapFilter; // group 'all', the rest ''
export const LISTING_LEGEND: [TypeGroup, string][]; // condo #22d3ee, house #f97316, townhome #facc15, land #16a34a, other #a21caf
export const PROJECT_LEGEND: [ProjectKind, string][]; // village #f97316, condo #22d3ee
export function normalizeListing(raw: RawListing): MapListing;
export function normalizeProject(raw: RawProject): MapProject;
export function loadListings(signal?: AbortSignal): Promise<MapListing[]>; // GET /listings.json
export function loadProjects(signal?: AbortSignal): Promise<MapProject[]>; // GET /projects.json
export function pinColor(p: MapPoint): string;
export function applyFilter<T extends MapPoint>(points: T[], f: MapFilter): T[];
export function summarize(points: MapPoint[]): { count: number; totalPrice: number; medianPrice: number; villages: number; condos: number };
export function findPoint(points: MapPoint[], query: string): MapPoint | undefined;
export interface Cluster<T> { lat: number; lng: number; items: T[] }
export function clusterByCell<T extends { lat: number; lng: number }>(
  items: T[], toPixel: (p: T) => { x: number; y: number }, cellPx: number): Cluster<T>[];
export function escapeHtml(s: string): string;
export function safeHttpUrl(s: string): string | null;
```

- [ ] **Step 1: Write failing tests** in `mapData.test.ts`:
  - `normalizeListing`: raw type `คอนโด` gives `condo`; `บ้าน` and `บ้านแฝด` give `house`; `ทาวน์โฮม` gives `townhome`; `ที่ดิน` gives `land`; `อาคารพาณิชย์` gives `other`. `area_sqm: null, land_sqwa: 100` gives `area === 400`. Both null gives `area === null`.
  - `applyFilter`: `group: 'land'` keeps only land; project mode `group: 'village'` matches `projectKind`; `priceMin: '5000000'` drops cheaper; `sizeMin` drops a null-area listing; min above max returns `[]`; non-numeric text in a bound is ignored.
  - `summarize([])` returns all zeros. Median of prices `[1, 2, 9]` is `2`. A project contributes to `villages` or `condos`.
  - `findPoint`: matches title, project name, district or sub-district, case-insensitive; a blank query returns `undefined`.
  - `clusterByCell`: two points in one 40 px cell form one cluster of 2 whose `lat`/`lng` are the mean; points in different cells form two clusters.
  - `escapeHtml('<img src=x onerror="a">&\'')` contains no raw `<`, `>`, `"`, `'`, and `&` is escaped.
  - `safeHttpUrl`: `https://x.co/a` passes; `javascript:alert(1)` and `not a url` return `null`.
- [ ] **Step 2: Run** `npx vitest run src/lib/__tests__/mapData.test.ts`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement `src/lib/mapData.ts`.** `clusterByCell` is a Map keyed by `floor(x/cell):floor(y/cell)`, linear in the point count, because project mode has 7,857 pins. `applyFilter` tests `group` against `p.group` for a listing and `p.projectKind` for a project.
- [ ] **Step 4: Run the test again.** Expected: PASS.
- [ ] **Step 5: Create `Data/build_map_projects.py`** with `json` only (no model import). Read `ml/models/projects.json`, keep projects with non-null `lat` and `lng`, keep the fields `key,name,kind,grade,n,ppsqm,price,area,province,district,sub_district,lat,lng`, round `lat`/`lng` to 6 places, write compact UTF-8 JSON to `public/projects.json`. Run it with `python -I Data/build_map_projects.py`. Expected output: 7857 projects written.
- [ ] **Step 6: Commit** `feat: map data layer and project pins file`.

---

### Task 3: Real map, real pins, filters, stats

**Files:**
- Modify: `src/components/MapCanvas.jsx`, `src/components/MapPanels.jsx`, `src/pages/MapPage.jsx`, `src/data.js`, `src/i18n.jsx`, `src/index.css`

**Interfaces:**
- Consumes: everything from `mapData.ts`.
- Produces: `MapCanvas` props `{ mode, points, baseMap, cityPlan, measuring, focus, target, onPick(lat, lng), onSelectPoint(point) }` and ref methods `zoomIn, zoomOut, flyTo, locate`. `target` is `{ lat, lng, source: 'map' | 'listing' | 'project', point?: MapPoint } | null`. `FilterPanel` props `{ mode, value, onApply(filter), onClose }`.

- [ ] **Step 1: Replace the drawn base map in `MapCanvas`.** Delete `hash`, `noise`, `fbm`, `CENTERS`, `PALETTES`, `colorAt`, `makeTileLayer`. Add a table of layers, each with its attribution, and swap layers on `baseMap` change:
  - `hybrid` (default): `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}` plus `.../Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`
  - `satellite`: World_Imagery only
  - `street`: `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`
  - `terrain`: `https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png`
  Set `attributionControl: true` and `maxZoom: 18`. The base map key `traffic` is gone: in `MapPanels` `BASES` it becomes `street`, and `i18n.jsx` gets `street` (th `แผนที่ถนน`, en `Street`, zh `街道`) in place of `traffic`.
- [ ] **Step 2: Replace pin rendering.** `renderPoints` uses `clusterByCell` with `cellPx` 48 over points inside the padded bounds. A cluster of 3 or more below zoom 17 draws `.map-cluster` and zooms on click, as now. Otherwise draw one `.map-dot` per point coloured by `pinColor`. Clicking a dot opens the popup and calls `onSelectPoint(point)`. The `redraw` closure reads `points` from a ref. `points` is empty when `mode` is null.
- [ ] **Step 3: Popup HTML.** Listing: image with `referrerpolicy="no-referrer"`, `loading="lazy"`, `alt=""`, width 220; title; `district · province`; red price; area; link labelled `t('openListing')` with `target="_blank" rel="noopener noreferrer"`, only when `safeHttpUrl` passes. Project: name; grade; `district · province`; median price; listing count `n`. Pass all scraped text through `escapeHtml`.
- [ ] **Step 4: Picking and the target marker.** Map click: if `measuring`, keep the current ruler behaviour and do not call `onPick`; otherwise call `onPick(lat, lng)`. Draw one highlighted `L.circleMarker` (radius 9, white stroke, fill `#d32f2f`) at `target`, updated by an effect.
- [ ] **Step 5: Data in `MapPage`.** Load both files once on mount with an `AbortController`. Keep `listings`, `projects`, `loadError`, `filter`. Reset `filter` to `EMPTY_FILTER` on mode change. `points = applyFilter(mode === 'future' ? projects : listings, filter)`. Pass `focus={linked}` as now.
- [ ] **Step 6: Stats, cards, legend, search.**
  - Land stats: `totalListings` count, `totalValue` in M THB, `medianPrice` in M THB. Future stats: `totalProjects`, `villages`, `condos`. All from `summarize(points)`.
  - Mode cards: counts are the real unfiltered totals, formatted with `toLocaleString('en-US')`; `—` while loading. The land card unit becomes `listings`.
  - Legend renders `LISTING_LEGEND` or `PROJECT_LEGEND` with `t(key)`.
  - `runSearch`: `PLACE_LABELS` first, then `findPoint(points, q)`, flying to zoom 15.
  - If `loadError` is set, show a small red inline note under the search bar: `t('dataLoadError')`.
- [ ] **Step 7: Areas.** In `data.js`, replace `AREAS` with `bangkok` (13.75, 100.52, zoom 12), `nonthaburi` (13.86, 100.51, zoom 12), `pathumthani` (14.02, 100.60, zoom 12), `samutprakan` (13.60, 100.60, zoom 12), each with an `art` field reusing an existing `areaArt` key (`bangkok`, `eec`, `phuket`, `khonkaen`), and call `areaArt(item.art)`. Delete `scatter`, `LAND_POINTS`, `FUTURE_POINTS`, `FUTURE_CENTERS`, `FUTURE_LEGEND`, `LAND_LEGEND`, `RAIL_LINES`, `RIVER`, `ROADS`. Keep `LISTINGS`, `PROVINCES`, `PLACE_LABELS` (drop the Chon Buri, Phuket, Khon Kaen labels). Add `art.js` keys only if needed.
- [ ] **Step 8: `FilterPanel`.** Replace `listing`, `posted`, `unit` fields with: type select (land mode: all + `LISTING_LEGEND` keys; future mode: all + `PROJECT_LEGEND` keys), size range (label `sizeSqm`), total price range. Apply calls `onApply(form)`. Clear calls `onApply(EMPTY_FILTER)`.
- [ ] **Step 9: i18n.** Change `future` copy to en `Projects`, th `โครงการและหมู่บ้าน`, zh `项目与小区`. Add th/en/zh for `condo, house, townhome, other, village, villages, condos, totalListings, medianPrice, sizeSqm, openListing, dataLoadError, street`. Remove `totalUsers, users, projectValue, investment, totalLand`, `owner`, `agent` only if no other file uses them (check with grep).
- [ ] **Step 10: Verify in a browser** at 1440 px and 390 px. Land mode shows clustered pins on real tiles around Bangkok; zooming splits clusters; a listing popup shows a photo; the type filter narrows pins and stats; future mode shows 7,857 projects; the ruler still works. Run `npm run build`.
- [ ] **Step 11: Commit** `feat: real base map and pins from listing and project data`.

---

### Task 4: Price form logic

**Files:**
- Create: `src/lib/priceForm.ts`, `src/lib/usePrediction.js`, `src/lib/__tests__/priceForm.test.ts`

**Interfaces:**
- Consumes: `MapPoint` from `mapData.ts`; `PredictionInput`, `predict` from `types.ts` / `api.ts`; `DEFAULT_SUBDISTRICT_ID`, `DEFAULT_YEAR` from `defaults.ts`.
- Produces:

```ts
export const AREA_MIN = 10; export const AREA_MAX = 20000; // ml/api.py limits
export const DEFAULT_FORM: PredictionInput; // condo, 65 sqm, 1 unit, DEFAULT_YEAR, DEFAULT_SUBDISTRICT_ID
export interface PriceTarget { lat: number; lng: number; source: 'map' | 'listing' | 'project'; point?: MapPoint }
export function isInCoverage(lat: number, lng: number): boolean; // 13.4<=lat<=14.3, 99.8<=lng<=101.0
export function targetPatch(target: PriceTarget): Partial<PredictionInput>;
export function toPayload(form: PredictionInput, target: PriceTarget | null): PredictionInput;
export function askingGap(asking: number, predicted: number): number; // percent, (asking/predicted-1)*100
```

`usePrediction(payload | null)` returns `{ result, resultPayload, running, error }`, debounced 450 ms, aborting any earlier request. A `null` payload cancels the pending request and clears `result` and `error`. It keeps the previous result on screen while the next one loads.

- [ ] **Step 1: Write failing tests:**
  - `isInCoverage(13.75, 100.5)` is true; `isInCoverage(18.79, 98.98)` is false.
  - `targetPatch` for a listing with group `land`, area 400, bedrooms null: `{ propertyType: 'land', area: 400 }` with no `bedrooms` key and `project`/`estate` cleared to `undefined`.
  - Group `other`: no `propertyType` key, area still set.
  - A village project with area 150: `propertyType: 'house'`, `area: 150`, `estate: 'in'`, `project: id`. A condo project: `propertyType: 'condo'`, `project: id`, no `estate`.
  - A plain map target: `{}` plus `project` cleared.
  - `toPayload` with target: sets `lat`/`lng`. Without target: `lat`/`lng` undefined and `subdistrictId` kept. Area 5 clamps to 10, area 30000 clamps to 20000.
  - `askingGap(110, 100)` is `10`.
- [ ] **Step 2: Run** `npx vitest run src/lib/__tests__/priceForm.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement both files.**
- [ ] **Step 4: Run the test again.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: price form logic`.

---

### Task 5: Native side panel

**Files:**
- Create: `src/components/PricePanel.jsx`
- Modify: `src/pages/MapPage.jsx`, `src/i18n.jsx`

**Interfaces:**
- Consumes: `usePrediction`, `toPayload`, `targetPatch`, `isInCoverage`, `askingGap`, `DEFAULT_FORM`, `AREA_MIN`, `AREA_MAX` (Task 4); `LOCATIONS` from `locations.ts`; `DEFAULT_GROWTH_PCT, GROWTH_MIN_PCT, GROWTH_MAX_PCT, GROWTH_STEP_PCT, HORIZONS_YEARS, compound` from `growth.ts`; `formatBaht` from `prediction.ts`; `getHealth` from `api.ts`.
- Produces: `PricePanel` props `{ target: PriceTarget | null, onClearTarget(), onClose() }`.

- [ ] **Step 1: Layout in `MapPage`.** Make the row inside `<main>` `flex`. Before the map stage, render `<aside>` when `chosen && panelOpen`: on `lg` and up, in-flow, `w-[380px] shrink-0 border-r border-line bg-white`; below `lg`, `fixed inset-x-0 bottom-0 z-[1500] max-h-[62dvh] rounded-t-xl shadow-lg`. The map stage is `min-w-0 flex-1`; its existing `ResizeObserver` keeps Leaflet sized. `panelOpen` starts true when `matchMedia('(min-width:1024px)')` matches. Add a `RoundButton` with `TrendingUp` and label `t('priceEstimate')` to the right stack; it toggles the panel.
- [ ] **Step 2: Target state in `MapPage`.** `onPick(lat, lng)` sets `{lat, lng, source: 'map'}`. `onSelectPoint(p)` sets `{lat: p.lat, lng: p.lng, source: p.kind, point: p}`. Both set `panelOpen` true. Clear `target` on mode change.
- [ ] **Step 3: Panel shell.** Red `bg-[#DC2626]` header matching `LayerPanel`: title `t('priceEstimate')`, a health dot from `getHealth` (green when ok, red when it fails), close button. Scrollable body. Footer: the asking-price notice `t('priceNotice')`.
- [ ] **Step 4: Form.** Location block: with a target, show the listing title, project name or coordinates, with a clear button calling `onClearTarget`; without one, show the hint `t('clickMapHint')` and three cascading selects (province, district, sub-district) over `LOCATIONS`. Then: property-type segmented control (condo, house, townhome, land); area number input (keep raw text while typing, clamp on blur, range hint `AREA_MIN`-`AREA_MAX`). Then a `<details>` for more: units, year (`YEAR_MIN`-`YEAR_MAX`), bedrooms, bathrooms, building age, and in/out/unknown estate for house and townhome only. On `target` change, merge `targetPatch(target)` into the form.
- [ ] **Step 5: Prediction states.** Payload is `null` when the target is outside coverage; show `t('outOfCoverage')` in place of a result. Running with no result: spinner. Error: `t('apiError')`, with the error text. The stale result dims to 60% while loading.
- [ ] **Step 6: Result.** In order:
  - Price: `formatBaht(predictedPrice)` in `font-display`, range low to high, `within_20pct` and `median_abs_pct_error`, resolved location, snapped project if any.
  - If `target.source === 'listing'` and the listing's group is one the model prices: asking price and `askingGap`, in red above +10%, green below -10%. For group `other`: `t('typeUnsupported')` and no gap.
  - Comparables: rows from `comparables` (district, sub-district, size band, exact size when `exact_size_n > 0`, otherwise nearest size), each with baht per sqm and count, with a thin warning when `district_n < 30`.
  - Models: stacked weight bar and per-model price from `contributions`.
  - Future value: slider on `GROWTH_MIN_PCT`-`GROWTH_MAX_PCT`, start at `DEFAULT_GROWTH_PCT[propertyType]`, table over `HORIZONS_YEARS` with `compound` for low, predicted and high, and the note `t('futureNote')` that this is an assumption and not a forecast.
- [ ] **Step 7: i18n.** Add th/en/zh for every panel string, including `priceEstimate, priceNotice, clickMapHint, outOfCoverage, apiError, typeUnsupported, futureNote`.
- [ ] **Step 8: Verify in a browser with the API running** (see Task 6 for the API). At 1440 px: panel docks left and the map resizes; click on the map gives a price; click a condo pin fills type and area and shows the asking gap; click a shop-house pin shows `typeUnsupported`; click in Chiang Mai shows `outOfCoverage` with no `/api/predict` request; stop the API and the panel shows `apiError` while pins still work. At 390 px: bottom sheet opens and closes, no sideways scroll. Run `npm run typecheck && npm test && npm run build`.
- [ ] **Step 9: Commit** `feat: native price estimate side panel`.

---

### Task 6: Docs and end-to-end check

**Files:**
- Modify: `README.md`, `.bolt/prompt` only if it describes the removed UI

- [ ] **Step 1: Rewrite `README.md`.** What the app is; `npm run dev` also starts the API; Python packages needed by `ml/api.py`; how `public/listings.json` and `public/projects.json` are rebuilt; tile providers and their attribution; `VITE_API_URL` for a separately hosted API.
- [ ] **Step 2: Grep for leftovers.** `grep -rn "maplibre\|react-leaflet\|useHashRoute\|LAND_POINTS\|FUTURE_POINTS" src package.json`. Expected: no hits.
- [ ] **Step 3: Run** `npm run typecheck && npm test && npm run lint && npm run build`. Expected: all pass. Check that `dist/` has `listings.json` and `projects.json`.
- [ ] **Step 4: Run** `npm run dev` with the real API, and repeat the Task 5 Step 8 flow once.
- [ ] **Step 5: Commit** `docs: describe merged OpenPlot app`.
