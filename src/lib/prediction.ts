const THAI_UNITS = { million: "ล้านบาท", baht: "บาท" };

/** Formats a baht amount. The unit labels default to Thai; pass others for other languages. */
export function formatBaht(value: number, units: { million: string; baht: string } = THAI_UNITS): string {
  const millions = value / 1_000_000;
  if (millions >= 1) {
    return `${millions.toFixed(2)} ${units.million}`;
  }
  return `${value.toLocaleString("en-US")} ${units.baht}`;
}
