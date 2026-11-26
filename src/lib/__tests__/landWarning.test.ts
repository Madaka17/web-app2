import { describe, it, expect } from "vitest";
import { isLandCollateral } from "../prediction";

describe("isLandCollateral", () => {
  it("is true for the Thai land type name the API returns", () => {
    expect(isLandCollateral("ที่ดิน")).toBe(true);
  });

  it("is false for other property types and missing values", () => {
    expect(isLandCollateral("คอนโด")).toBe(false);
    expect(isLandCollateral("บ้านเดี่ยว")).toBe(false);
    expect(isLandCollateral("")).toBe(false);
    expect(isLandCollateral(null)).toBe(false);
    expect(isLandCollateral(undefined)).toBe(false);
  });
});
