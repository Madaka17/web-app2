import { describe, expect, it } from "vitest";
import { FEATURE_LABELS } from "../featureLabels";
import api from "../../../ml/api.py?raw";

// The model report lists features by their raw names; any name missing here
// shows up on the page as e.g. "proj_ppsqm" instead of Thai.
describe("FEATURE_LABELS", () => {
  it("labels every feature ml/api.py labels", () => {
    const block = api.match(/FEATURE_LABELS = \{([\s\S]*?)\n\}/)?.[1] ?? "";
    const keys = [...block.matchAll(/^\s+"(\w+)":/gm)].map((m) => m[1]);
    expect(keys.length).toBeGreaterThan(30);
    expect(keys.filter((k) => !(k in FEATURE_LABELS))).toEqual([]);
  });
});
