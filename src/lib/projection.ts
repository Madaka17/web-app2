import { compound } from "@/lib/growth";

export interface ProjectionPoint {
  year: number;
  low: number;
  mid: number;
  high: number;
}

/**
 * Projects low / mid / high values forward at a constant annual rate.
 * Returns years + 1 points, the first being today's values (year = startYear).
 */
export function projectSeries(
  mid: number,
  low: number,
  high: number,
  ratePct: number,
  startYear: number,
  years: number,
): ProjectionPoint[] {
  const points: ProjectionPoint[] = [];
  for (let i = 0; i <= years; i++) {
    points.push({
      year: startYear + i,
      low: compound(low, ratePct, i),
      mid: compound(mid, ratePct, i),
      high: compound(high, ratePct, i),
    });
  }
  return points;
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

function toPoints(
  values: number[],
  width: number,
  height: number,
  min: number,
  max: number,
): string[] {
  const n = values.length;
  const span = max - min;
  return values.map((v, i) => {
    const x = n > 1 ? (i * width) / (n - 1) : 0;
    const y = span === 0 ? height / 2 : height - ((v - min) / span) * height;
    return `${round1(x)},${round1(y)}`;
  });
}

/**
 * Builds an SVG path `d` for a polyline through values. X spans 0..width evenly;
 * min maps to the bottom (y = height) and max to the top (y = 0). When max equals
 * min, every point sits on the vertical midline.
 */
export function toPath(
  values: number[],
  width: number,
  height: number,
  min: number,
  max: number,
): string {
  return toPoints(values, width, height, min, max)
    .map((pt, i) => `${i === 0 ? "M" : "L"}${pt}`)
    .join(" ");
}

/**
 * Builds a closed SVG polygon between two series: the high edge left to right,
 * then the low edge right to left, ending with `Z`.
 */
export function toBandPath(
  low: number[],
  high: number[],
  width: number,
  height: number,
  min: number,
  max: number,
): string {
  const up = toPoints(high, width, height, min, max).map((pt, i) => `${i === 0 ? "M" : "L"}${pt}`);
  const back = toPoints(low, width, height, min, max)
    .reverse()
    .map((pt) => `L${pt}`);
  return `${[...up, ...back].join(" ")} Z`;
}
