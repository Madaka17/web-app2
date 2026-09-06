import { describe, it, expect } from "vitest";
import { formatBaht } from "../prediction";

describe("formatBaht", () => {
  it("uses millions above 1M", () => {
    expect(formatBaht(8_490_000)).toBe("8.49 ล้านบาท");
  });

  it("falls back to grouped baht below 1M", () => {
    expect(formatBaht(750_000)).toBe("750,000 บาท");
  });

  it("handles the 1M boundary", () => {
    expect(formatBaht(1_000_000)).toBe("1.00 ล้านบาท");
    expect(formatBaht(999_999)).toBe("999,999 บาท");
  });
});
