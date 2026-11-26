import { describe, it, expect } from "vitest";
import { strings } from "../../i18n.jsx";

const LIMITATION_KEYS = ["limitsTitle", "limitAsking", "limitSnapshot", "limitCoverage", "limitLand"];
const LANGS = ["th", "en", "zh"] as const;

describe("limitations copy", () => {
  it.each(LANGS)("has every limitation string in %s", (lang) => {
    for (const key of LIMITATION_KEYS) {
      expect(strings[lang][key], `${lang}.${key}`).toEqual(expect.any(String));
      expect(strings[lang][key].trim(), `${lang}.${key}`).not.toBe("");
    }
  });

  it.each(LANGS)("has the land-accuracy warning in %s", (lang) => {
    expect(strings[lang].landLowAccuracy.trim()).not.toBe("");
  });

  it("no longer carries the future value keys", () => {
    for (const lang of LANGS) {
      for (const key of ["futureValue", "growthRate", "horizon", "futureNote"]) {
        expect(strings[lang][key], `${lang}.${key}`).toBeUndefined();
      }
    }
  });
});
