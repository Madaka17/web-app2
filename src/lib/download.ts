import { PredictionInput, PredictionResult } from "./types";
import { formatBaht } from "./prediction";
import { findLocationPath } from "./locations";

function getLocationLabel(subdistrictId: string): string {
  const path = findLocationPath(subdistrictId);
  if (!path) return subdistrictId;
  return `${path.region.name} › ${path.district.name} › ${path.subdistrict.name}`;
}

/**
 * Escape a value for CSV. Numbers pass through; strings are quoted when they
 * contain a delimiter and prefixed with ' when they could be read as a formula
 * by Excel / Sheets (CSV injection).
 */
function csvCell(value: string | number): string {
  if (typeof value === "number") return String(value);
  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

function csvRow(...cells: Array<string | number>): string {
  return cells.map(csvCell).join(",");
}

export interface Report {
  input: PredictionInput;
  result: PredictionResult;
  location: string;
  timestamp: string;
}

export function buildReport(input: PredictionInput, result: PredictionResult): Report {
  return {
    input,
    result,
    location: getLocationLabel(input.subdistrictId),
    timestamp: new Date().toISOString(),
  };
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function reportToJSON(input: PredictionInput, result: PredictionResult): string {
  return JSON.stringify(buildReport(input, result), null, 2);
}

export function reportToCSV(input: PredictionInput, result: PredictionResult): string {
  const report = buildReport(input, result);

  const rows: string[] = [];
  rows.push(csvRow("Category", "Field", "Value", "Unit"));
  rows.push(csvRow("Input", "Property Type", input.propertyType, "-"));
  rows.push(csvRow("Input", "Area", input.area, "sqm"));
  rows.push(csvRow("Input", "Units", input.nUnits, "units"));
  rows.push(csvRow("Input", "Appraisal Year", input.year, "BE"));
  rows.push(csvRow("Input", "Location", report.location, "-"));
  rows.push(csvRow("Output", "Predicted Price", result.predictedPrice, "THB"));
  rows.push(csvRow("Output", "Lower Bound", result.lowerBound, "THB"));
  rows.push(csvRow("Output", "Upper Bound", result.upperBound, "THB"));
  rows.push(csvRow("Output", "Confidence", result.confidence.toFixed(1), "percent"));
  if (result.market) {
    rows.push(csvRow("Market", "Estimated Market Price", result.market.price, "THB"));
    rows.push(csvRow("Market", "Asking/Appraisal Ratio", result.market.ratio, "x"));
    rows.push(csvRow("Market", "Listings Behind Ratio", result.market.listings, "listings"));
    rows.push(csvRow("Market", "Basis", result.market.basis, "-"));
  }

  for (const c of result.contributions) {
    rows.push(csvRow("Ensemble", `${c.name} Weight`, (c.weight * 100).toFixed(0), "percent"));
    rows.push(csvRow("Ensemble", `${c.name} Prediction`, c.prediction, "THB"));
  }

  for (const f of result.features) {
    rows.push(csvRow("Feature Importance", f.label, (f.value * 100).toFixed(0), "percent"));
  }

  rows.push(csvRow("Meta", "Generated At", report.timestamp, "-"));
  rows.push(csvRow("Meta", "Disclaimer", "Simulated demo output - not a real appraisal", "-"));
  return rows.join("\n");
}

export function reportToText(input: PredictionInput, result: PredictionResult): string {
  const report = buildReport(input, result);

  const lines: string[] = [];
  lines.push("========================================");
  lines.push("  AI REAL ESTATE PRICE PREDICTOR REPORT");
  lines.push("========================================");
  lines.push("");
  lines.push(`Generated: ${report.timestamp}`);
  lines.push("");
  lines.push("--- INPUT PARAMETERS ---");
  lines.push(`  Property Type:    ${input.propertyType}`);
  lines.push(`  Area (sqm):       ${input.area}`);
  lines.push(`  Units:            ${input.nUnits}`);
  lines.push(`  Appraisal Year:   ${input.year} BE`);
  lines.push(`  Location:         ${report.location}`);
  lines.push("");
  lines.push("--- PREDICTION RESULT ---");
  lines.push(`  Predicted Price:  ${formatBaht(result.predictedPrice)}`);
  lines.push(`  Lower Bound:      ${formatBaht(result.lowerBound)}`);
  lines.push(`  Upper Bound:      ${formatBaht(result.upperBound)}`);
  lines.push(`  Confidence:       ${result.confidence.toFixed(1)}%`);
  if (result.market) {
    lines.push("");
    lines.push("--- MARKET ESTIMATE ---");
    lines.push(`  Estimated Market: ${formatBaht(result.market.price)}`);
    lines.push(`  Ratio:            x${result.market.ratio.toFixed(2)} (${result.market.listings} listings, ${result.market.scope})`);
    lines.push(`  Basis:            ${result.market.basis}`);
  }
  lines.push("");
  lines.push("--- ENSEMBLE BREAKDOWN ---");
  for (const c of result.contributions) {
    lines.push(`  ${c.name}: ${(c.weight * 100).toFixed(0)}% → ${formatBaht(c.prediction)}`);
  }
  lines.push("");
  lines.push("--- FEATURE IMPORTANCE ---");
  for (const f of result.features) {
    lines.push(`  ${f.label}: ${(f.value * 100).toFixed(0)}%`);
  }
  lines.push("");
  lines.push("========================================");
  lines.push("  DEMO — figures are simulated, not a real appraisal");
  lines.push("========================================");
  return lines.join("\n");
}
