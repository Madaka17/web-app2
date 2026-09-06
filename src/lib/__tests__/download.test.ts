import { describe, it, expect } from "vitest";
import { reportToCSV, reportToJSON, reportToText } from "../download";
import { PredictionInput, PredictionResult } from "../types";
import { DEFAULT_SUBDISTRICT_ID, DEFAULT_YEAR } from "../defaults";

const input: PredictionInput = {
  propertyType: "condo",
  area: 65,
  nUnits: 1,
  year: DEFAULT_YEAR,
  subdistrictId: DEFAULT_SUBDISTRICT_ID,
};
// A frozen sample of what the model API returns, so these tests cover the
// report formatting rather than the model.
const result: PredictionResult = {
  predictedPrice: 10_427_000,
  lowerBound: 6_815_000,
  upperBound: 15_986_000,
  confidence: 48.9,
  contributions: [
    { name: "XGBoost", weight: 0.7, color: "#3b82f6", prediction: 10_627_000 },
    { name: "LightGBM", weight: 0.2, color: "#22c55e", prediction: 9_960_000 },
    { name: "CatBoost", weight: 0.1, color: "#f97316", prediction: 9_298_000 },
  ],
  features: [
    { label: "ราคาต่อ ตร.ม. ของเขต", value: 0.2658, icon: "MapPin" },
    { label: "พื้นที่ใช้สอย", value: 0.1934, icon: "Maximize" },
  ],
};

describe("reportToCSV", () => {
  it("emits one header plus a row per field", () => {
    const lines = reportToCSV(input, result).split("\n");
    expect(lines[0]).toBe("Category,Field,Value,Unit");
    expect(lines.length).toBeGreaterThan(10);
  });

  it("resolves the location instead of leaking the raw id", () => {
    const csv = reportToCSV(input, result);
    expect(csv).toContain("กรุงเทพมหานคร › คลองเตย › คลองเตย");
    expect(csv).not.toContain(`,${DEFAULT_SUBDISTRICT_ID},`);
  });

  it("neutralises formula-injection payloads", () => {
    const csv = reportToCSV(
      input,
      { ...result, features: [{ label: "=1+1", value: 0.5, icon: "MapPin" }] },
    );
    expect(csv).toContain("'=1+1");
    expect(csv).not.toMatch(/,=1\+1,/);
  });

  it("quotes and escapes values containing commas or quotes", () => {
    const csv = reportToCSV(
      input,
      { ...result, features: [{ label: 'a,b "c"', value: 0.5, icon: "MapPin" }] },
    );
    expect(csv).toContain('"a,b ""c"""');
  });

  it("keeps every row at four columns", () => {
    for (const line of reportToCSV(input, result).split("\n")) {
      // Split on commas that are not inside a quoted cell.
      const cells = line.match(/("([^"]|"")*"|[^,]*)(,|$)/g) ?? [];
      expect(cells.filter((c) => c !== "").length).toBe(4);
    }
  });
});

describe("reportToJSON", () => {
  it("round-trips to an object carrying input, result and location", () => {
    const parsed = JSON.parse(reportToJSON(input, result));
    expect(parsed.input.area).toBe(65);
    expect(parsed.result.predictedPrice).toBe(result.predictedPrice);
    expect(parsed.location).toContain("คลองเตย");
    expect(Date.parse(parsed.timestamp)).not.toBeNaN();
  });
});

describe("reportToText", () => {
  it("marks the output as simulated", () => {
    expect(reportToText(input, result)).toContain("DEMO");
  });
});
