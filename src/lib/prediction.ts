export function formatBaht(value: number): string {
  const millions = value / 1_000_000;
  if (millions >= 1) {
    return `${millions.toFixed(2)} ล้านบาท`;
  }
  return `${value.toLocaleString("en-US")} บาท`;
}
