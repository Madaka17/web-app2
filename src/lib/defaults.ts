/**
 * Default location for both predictors. Must be a real id from locations.ts —
 * an unknown id silently falls back to a generic price per sqm.
 * Covered by locations.test.ts.
 */
export const DEFAULT_SUBDISTRICT_ID = "103301"; // แขวงคลองเตย เขตคลองเตย กรุงเทพมหานคร

/**
 * The listings run 2559-2569 (BE) but are thin before 2561; the served model
 * is fit through 2568, so an unspecified valuation is dated to the current year.
 */
export const YEAR_MIN = 2561;
export const YEAR_MAX = 2569;
export const DEFAULT_YEAR = 2569;
