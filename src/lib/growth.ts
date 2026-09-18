import { PropertyType } from "./types";

/**
 * Starting annual growth rate for the future-value panel, per property type.
 *
 * These are ASSUMPTIONS, not measured from the listings. The scraped data
 * cannot yield a trend: nearly all of it is one 2569 snapshot, and the older
 * listings still live are the unsold, over-priced ones. The figures are
 * rough long-run averages in the spirit of the Bank of Thailand / REIC
 * residential price indices (condo slowest, land fastest); the user can move
 * the slider to any rate they believe in.
 */
export const DEFAULT_GROWTH_PCT: Record<PropertyType, number> = {
  condo: 2.5,
  townhome: 3,
  house: 3.5,
  land: 5,
};

export const GROWTH_MIN_PCT = -5;
export const GROWTH_MAX_PCT = 10;
export const GROWTH_STEP_PCT = 0.5;

export const HORIZONS_YEARS = [1, 3, 5, 10] as const;

export function compound(value: number, ratePct: number, years: number): number {
  return value * Math.pow(1 + ratePct / 100, years);
}
