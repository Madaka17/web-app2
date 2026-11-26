// Pure helpers for the per-property explanation section (PricePanel).

const GROUP_LABEL_KEYS: Record<string, string> = {
  location: "groupLocation",
  comparables: "groupComparables",
  size: "groupSize",
  unit: "groupUnit",
  type_project: "groupType_project",
  time: "groupTime",
};

/** i18n key for an explanation group key, or null when the group is unknown. */
export function groupLabelKey(key: string): string | null {
  return GROUP_LABEL_KEYS[key] ?? null;
}

/** Signed percent to one decimal place, with U+2212 as the minus sign. */
export function signedPct(pct: number): string {
  const rounded = Math.round(pct * 10) / 10;
  if (rounded === 0) return "0.0%";
  const sign = rounded > 0 ? "+" : "\u2212";
  return `${sign}${Math.abs(rounded).toFixed(1)}%`;
}

/** Bar length as a percent of the track: half the track is the largest effect. */
export function barWidth(pct: number, maxAbsPct: number): number {
  if (!(maxAbsPct > 0)) return 0;
  return Math.min(50, (Math.abs(pct) / maxAbsPct) * 50);
}
