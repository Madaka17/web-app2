# Space Horizon UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the app after the user's two references: a purple "planet horizon" hero with the inputs sitting on the horizon and a glossy orb submit button, followed by a "สรุปผล" row of three result cards.

**Architecture:** Colours stay as CSS custom properties in `src/index.css` (Tailwind reads them through `tailwind.config.js`), so the palette swap reaches every page. The sidebar and header are replaced by one centred top nav. Only the predictor page gets a new layout. Its state logic is unchanged, and the result panel's top is replaced by three cards.

**Tech Stack:** React 18 + TypeScript, Vite 5, Tailwind 3, lucide-react, vitest. No new dependencies.

**Spec:** The references are the screenshot the user pasted (a crypto calculator: centred top nav, a row of three inputs with captions below, a "CONCLUSION" row with a line-chart card, an amount card with a gradient button, and a ring-gauge card) and `C:\Users\user\Desktop\large-thumbnail20240119-28792-d8xmd5.mp4`. The video is a still hero: a spaced wordmark "CARVARRO", a subtitle, a tagline, a dark planet arc with a violet/magenta/orange rim glow, three inputs on the arc with captions below, and an orb button with curved text "CALCULATE". The user declined clarifying questions, so the decisions below are the plan's defaults.

## Global Constraints

- All UI copy stays Thai. The only English is the wordmark subtitle.
- Dark is the default and the design target. The light toggle stays and must stay readable, with lavender light tokens.
- Do not change any API call, the prediction state logic in `PredictorDashboard.tsx` (handlers, debounce, abort), or any page other than the predictor page, except through shared tokens and the nav.
- No new npm dependencies. Draw charts and rings as inline SVG.
- Respect `prefers-reduced-motion`. The existing global rule in `index.css` already covers CSS animations.
- Phone width 360px: no horizontal page scroll, and the inputs stack vertically.
- `npm run typecheck`, `npm run lint` and `npm test` pass after every task.

## Review Focus

- Location dropdown inside the narrow hero slot: its 3-column panel must open at a readable width (≥ 600px on desktop, full width on phone) and not be clipped by the horizon container (`overflow-hidden` on an ancestor would clip it).
- Growth rate of 0% or negative in the trend chart: the line is flat or falling, the y-axis still spans low..high, and nothing divides by zero.
- Light mode: the horizon, the orb and the cards must stay legible on the lavender canvas (no white text on a white surface).
- Nav with 7 items at 1024px: it must fit on one line or fall back to the menu button; it must never wrap to two rows.
- Map page: it still fills its height under the new top nav (an earlier commit fixed a zero-height map container; see `d64bbec`).

---

### Task 1: Purple palette and hero CSS primitives

**Files:**
- Modify: `src/index.css` (`:root`, `.dark`, `body`, `.btn-primary`, `.card`, add utilities)

**Interfaces:**
- Produces CSS classes for later tasks:
  - `.horizon`: wrapper. It is `position: relative`, has no overflow clipping, and draws the planet arc and rim glow in `::before`/`::after`. It is positioned so the arc crest sits about 55% down the wrapper.
  - `.wordmark`: wide letter-spaced display title (`letter-spacing: 0.32em`, a white-to-lavender gradient text fill).
  - `.glass-field`: a dark translucent input shell (rounded-xl, 1px light border at 8% opacity, inner top highlight).
  - `.orb-btn`: a 64px round glossy button with a magenta/violet/amber radial gradient, an outer glow and a hover lift. The `.orb-btn svg text` style is for the curved caption.
  - `.section-title`: centred, spaced uppercase-style heading (`letter-spacing: 0.3em`).

- [ ] **Step 1: Replace the `.dark` tokens with the violet palette**
  - `--c-canvas: 9 6 22`, `--c-surface: 22 15 44`, `--c-raised: 32 23 62`, `--c-line: 62 48 104`
  - `--c-ink: 240 236 255`, `--c-muted: 170 160 210`, `--c-faint: 112 102 150`
  - `--c-accent: 196 140 255`, `--c-accent-soft: 44 24 78`, `--c-accent-ink: 236 220 255`, `--c-accent-2: 244 114 182`
  - `--c-glow: 168 85 247`. Keep ok/warn/bad unchanged.
- [ ] **Step 2: Replace the `:root` (light) tokens with lavender**
  - `--c-canvas: 244 240 255`, `--c-surface: 255 255 255`, `--c-raised: 238 232 255`, `--c-line: 220 210 245`
  - `--c-ink: 30 16 64`, `--c-muted: 98 82 150`, `--c-faint: 150 138 190`
  - `--c-accent: 124 58 237`, `--c-accent-soft: 237 228 255`, `--c-accent-ink: 76 29 149`, `--c-accent-2: 219 39 119`, `--c-glow: 124 58 237`
- [ ] **Step 3: Change `body` nebula gradients and `.btn-primary`**
  - `body`: use violet and magenta glows. The orange accent is only `rgb(251 146 60 / 0.10)` at the far sides.
  - `.btn-primary`: `linear-gradient(110deg, rgb(147 51 234), rgb(219 39 119) 55%, rgb(249 115 22))`. This is the pill gradient of the reference's "BUY CRYPTO" button.
- [ ] **Step 4: Add `.horizon`, `.wordmark`, `.glass-field`, `.orb-btn` and `.section-title` to `@layer utilities`**
  - Arc: an ellipse, `width: 170%`, `left: -35%`, `aspect-ratio: 2.4 / 1`, top at 55%, background `rgb(var(--c-canvas))`.
  - Rim: `box-shadow: 0 -2px 0 rgb(216 180 254 / 0.55), 0 -30px 80px -10px rgb(168 85 247 / 0.55), 0 -10px 120px 10px rgb(236 72 153 / 0.25)`.
  - Glow above the arc: a radial gradient centred on the crest.
  - In light mode, the arc uses `rgb(var(--c-surface))` and the rim opacity is halved.
- [ ] **Step 5: Verify**
  - Run `npm run typecheck`, `npm run lint` and `npm test`. Expected: all pass.
  - Open `http://127.0.0.1:5173/#/metrics` (dev server already running). Expected: purple accents and no cyan left. Check with `rg -n "94 234 255|8 145 178" src`; it should return nothing.
- [ ] **Step 6: Commit** `feat(ui): violet space palette and horizon primitives`

### Task 2: Centred top nav replaces sidebar and header

**Files:**
- Create: `src/components/TopNav.tsx`
- Modify: `src/App.tsx` (layout: drop the `flex` + Sidebar column, render `<TopNav>`, `main` keeps `max-w-6xl`)
- Delete: `src/components/Sidebar.tsx`, `src/components/Header.tsx` (no other importers; confirm with `rg -n "Sidebar|Header" src`)

**Interfaces:**
- Produces: `export function TopNav(props: { activePage: PageId; onNavigate: (p: PageId) => void }): JSX.Element`
- Consumes: `useTheme()` from `@/context/theme` and `useModelHealth()` from `@/lib/useApi` (same as the old Sidebar footer).

- [ ] **Step 1: Build `TopNav`**
  - Sticky top bar, `h-16`, transparent until the user scrolls past 8px; then `bg-canvas/70 backdrop-blur-xl` and a bottom border.
  - Left: the brand (`brand-mark` ฿ + "ราคาบ้าน").
  - Centre: nav links with the old `NAV_ITEMS` labels (no icons, no hints), at `text-[13px]`. The active link is `text-ink` with a 2px accent underline glow. Inactive links are `text-muted hover:text-ink`.
  - Right: a model status dot (green/red/grey as in the old footer, with a `title` tooltip listing the weights) and the theme toggle.
  - Below `xl` (1280px): hide the centre links and show a menu button. The button opens a dropdown panel under the bar that lists all 7 links. The panel closes on Escape, on an outside click and after navigating.
  - Below `lg`: hide the warning chip "ราคาประกาศขาย ไม่ใช่ราคาประเมินทางการ". At lg and up, move the chip into the footer of `App.tsx`; it is a disclaimer, not nav.
- [ ] **Step 2: Rewire `App.tsx`**
  - Remove the `sidebarOpen` state.
  - Add the warning chip text to the footer's first paragraph.
- [ ] **Step 3: Verify**
  - Run `npm run typecheck`, `npm run lint` and `npm test`. Expected: pass.
  - Check the browser at 1440px: one-line centred nav.
  - Check at 1024px and 375px: menu button, and the dropdown navigates.
  - `#/map`: the map is visible at full height.
- [ ] **Step 4: Commit** `feat(ui): centred top nav replaces sidebar`

### Task 3: Projection series helper (TDD)

**Files:**
- Create: `src/lib/projection.ts`
- Test: `src/lib/__tests__/projection.test.ts`

**Interfaces:**
- Consumes: `compound(value, ratePct, years)` from `@/lib/growth`
- Produces:
  - `export interface ProjectionPoint { year: number; low: number; mid: number; high: number }`
  - `export function projectSeries(mid: number, low: number, high: number, ratePct: number, startYear: number, years: number): ProjectionPoint[]`. It returns `years + 1` points, year `startYear + i` for `i = 0..years`, each value `compound(x, ratePct, i)`.
  - `export function toPath(values: number[], width: number, height: number, min: number, max: number): string`. It returns an SVG `d` that starts with `M`, spaces x evenly from 0 to width, and puts y = height at min and 0 at max. When `max === min`, every y is `height / 2`.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import { projectSeries, toPath } from "../projection";

describe("projectSeries", () => {
  it("starts at today's values and has years + 1 points", () => {
    const s = projectSeries(3_000_000, 2_500_000, 3_600_000, 3, 2569, 10);
    expect(s).toHaveLength(11);
    expect(s[0]).toEqual({ year: 2569, low: 2_500_000, mid: 3_000_000, high: 3_600_000 });
    expect(s[10].year).toBe(2579);
    expect(s[10].mid).toBeCloseTo(3_000_000 * 1.03 ** 10, 0);
  });
  it("stays flat at 0% growth", () => {
    expect(projectSeries(1, 1, 1, 0, 2569, 5).every((p) => p.mid === 1)).toBe(true);
  });
  it("falls with a negative rate", () => {
    const s = projectSeries(100, 90, 110, -5, 2569, 2);
    expect(s[2].mid).toBeLessThan(s[0].mid);
  });
});

describe("toPath", () => {
  it("maps min to the bottom and max to the top", () => {
    expect(toPath([0, 10], 100, 50, 0, 10)).toBe("M0,50 L100,0");
  });
  it("draws a flat midline when max equals min", () => {
    expect(toPath([5, 5, 5], 100, 40, 5, 5)).toBe("M0,20 L50,20 L100,20");
  });
});
```

- [ ] **Step 2: Run** `npx vitest run src/lib/__tests__/projection.test.ts`. Expected: FAIL, because the module cannot be resolved.
- [ ] **Step 3: Implement both functions in `src/lib/projection.ts`.** Format numbers in the path with `Math.round(n * 10) / 10`, so the tests' integer outputs print without decimals.
- [ ] **Step 4: Run the same command.** Expected: 5 passed.
- [ ] **Step 5: Commit** `feat(ui): projection series and svg path helpers`

### Task 4: Predictor hero with inputs on the horizon

**Files:**
- Modify: `src/components/PredictorDashboard.tsx` (JSX from the `return (` onward; logic above it untouched)
- Modify: `src/components/LocationSelector.tsx` (add two optional props)

**Interfaces:**
- `LocationSelector` gains `hideHeader?: boolean` (it skips the "ทำเล / จังหวัด › เขต › แขวง" header row) and `wide?: boolean`. When `wide` is set, the dropdown panel uses `sm:left-1/2 sm:w-[min(680px,92vw)] sm:-translate-x-1/2` instead of `w-full`. Both default to `false`, so the existing behaviour is unchanged.
- Consumes the Task 1 classes `.horizon`, `.wordmark`, `.glass-field` and `.orb-btn`.

- [ ] **Step 1: Hero block**, centred, inside `.horizon`:
  - Wordmark `ราคาบ้าน` (`.wordmark`, `text-[40px] sm:text-[56px]`).
  - Subtitle `AI based property price estimator` (`text-muted text-[15px]`).
  - Tagline `ประกาศขายจริงกว่า 2 แสนรายการ · กรุงเทพฯ และปริมณฑล` (`text-[13px] text-ink/80`).
  - `<ModelStatus />` sits under the tagline.
- [ ] **Step 2: Input row on the arc**
  - Layout: `grid gap-4 sm:grid-cols-3`, `max-w-3xl mx-auto`, placed after the arc crest.
  - Each slot is a `.glass-field` control with a caption under it (`text-[12px] text-muted text-center mt-2`):
    1. A `<select>` of `PROPERTY_TYPES`, wired to the same `setInput` call as the old type buttons. Caption: `ประเภททรัพย์`.
    2. The area number input with a `ตร.ม.` suffix, using the existing `handleFieldChange`/`handleFieldBlur` for the `area` FieldConfig. Caption: `พื้นที่ใช้สอย`.
    3. `<LocationSelector hideHeader wide …/>`. Caption: `ทำเล`.
  - The three point/village notes under the location stay, centred, below the row.
  - On `sm` and up, give the slots a light 3D tilt that follows the arc, as in the video: left `rotate-[-2deg] translate-y-2`, centre none, right `rotate-[2deg] translate-y-2`. Do not tilt on phones.
- [ ] **Step 3: Orb submit**
  - A `.orb-btn` centred below the row, `type="submit"`, `aria-label="ประเมินราคา"`.
  - Under it, an inline SVG with `<textPath>` along a bottom arc reading `ประเมินราคา`.
  - While `isRunning`, the orb shows `Loader2` spinning inside it.
- [ ] **Step 4: More options**
  - A `<details>` panel (`.card`, `max-w-3xl mx-auto`), summary `ตัวเลือกเพิ่มเติม`.
  - Contents: the `nUnits` and `year` fields (from `GENERAL_FIELDS`, reusing the same input markup), the three `OPTIONAL_FIELDS`, and `<EstatePicker …/>` with unchanged props.
  - It is closed by default.
- [ ] **Step 5: Result area**
  - Full width below the hero (no 12-column grid any more).
  - Same status/loading/error branches.
  - `ResultPanel` gets the same props.
- [ ] **Step 6: Verify**
  - Run `npm run typecheck`, `npm run lint` and `npm test`. Expected: pass.
  - Browser at 1440px: the arc is visible, the inputs sit on it, and the orb submits. Changing the area re-prices after about 0.5s.
  - The location dropdown opens wide, is not clipped, and picking a sub-district re-prices.
  - Browser at 375px: the inputs stack, with no horizontal scroll.
  - Light mode is legible.
- [ ] **Step 7: Commit** `feat(ui): horizon hero with inputs and orb button`

### Task 5: "สรุปผล" conclusion cards

**Files:**
- Create: `src/components/ConclusionCards.tsx`
- Modify: `src/components/ResultPanel.tsx`
  - Replace the top price `<section>` and the accuracy `<section>` with `<ConclusionCards>`.
  - Move the growth `rate` state up from `FutureValue` into `ResultPanel` and pass it down.
  - Export `DownloadMenu`, `Baht` and `Num` for reuse.

**Interfaces:**
- Consumes `projectSeries` and `toPath` (Task 3), and `DEFAULT_GROWTH_PCT` and `compound` from `@/lib/growth`.
- Produces: `export function ConclusionCards(props: { result: ApiPrediction; input: PredictionInput; rate: number }): JSX.Element`
- `FutureValue` becomes `FutureValue({ result, input, rate, onRate }: ResultPanelProps & { rate: number; onRate: (r: number) => void })`.

- [ ] **Step 1: Heading.** `<h2 className="section-title">สรุปผล</h2>` above a `grid gap-4 md:grid-cols-3` row.
- [ ] **Step 2: Card 1, trend (caption below the card: `แนวโน้มราคา`)**
  - Header: `result.meta.collateral_type` on the left. On the right, today's price `<Baht>` and `+X.X%/ปี` in accent-2.
  - The chart is an SVG with `viewBox="0 0 300 160"` showing `projectSeries(predicted, lower, upper, rate, input.year, 10)`:
    - The low..high band is a filled area at 15% accent opacity.
    - The mid line uses a violet-to-pink `linearGradient` stroke with a glow filter.
    - Faint horizontal grid lines.
    - The x labels are the first, middle and last year.
  - The y range is the series min(low)..max(high).
- [ ] **Step 3: Card 2, estimate (caption: `ราคาคาดการณ์`)**
  - Two `.glass-field` rows. Row one: `฿` and the price `<Baht>`. Row two: `ตร.ม.`, `<Num value={perSqm}>` and `฿/ตร.ม.`.
  - A small line: `ช่วง {formatBaht(lower)} – {formatBaht(upper)}`.
  - The meta line: sub-district and district, plus the estate chip from the old section when present.
  - `<DownloadMenu>`, restyled as a full-width `btn-primary` pill (`rounded-full`).
- [ ] **Step 4: Card 3, accuracy ring (caption: `ความแม่นยำ`)**
  - An SVG ring, r=70, stroke 10.
  - The track is `rgb(var(--c-line))`. The arc is a violet-to-pink gradient filling `within_20pct / 100` of the circumference via `stroke-dasharray`, starting at 12 o'clock.
  - Centre: a small faint line `ถูกภายใน ±20%`, a big `{within_20pct}%`, then `คลาดเคลื่อนกลาง {median_abs_pct_error}%`.
  - Legend below: `ตัวอย่าง {sample_size}`. When `!district_in_training_data`, show the warn note from the old section.
- [ ] **Step 5: `FutureValue`** keeps its table but uses `rate`/`onRate` from props, so the slider moves the trend chart too.
- [ ] **Step 6: Verify**
  - Run `npm run typecheck`, `npm run lint` and `npm test`. Expected: pass.
  - In the browser, price a condo. Expected: three cards in a row at md+ and stacked on a phone.
  - Moving the growth slider to -5% bends the chart down. At 0% the chart is flat.
  - The download menu still saves JSON/CSV/TXT.
  - Light mode is legible.
- [ ] **Step 7: Commit** `feat(ui): conclusion cards with trend chart and accuracy ring`
