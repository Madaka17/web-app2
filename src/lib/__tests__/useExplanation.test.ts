import { describe, it, expect } from "vitest";
import { selectExplanationState } from "../useExplanation";

const previous = {
  key: '{"area":40}',
  explanation: { price: 1 },
  loading: false,
  error: null,
};

describe("selectExplanationState", () => {
  it("returns the empty state for a null key, never the previous explanation", () => {
    expect(selectExplanationState(previous, null)).toEqual({
      key: null,
      explanation: null,
      loading: false,
      error: null,
    });
  });

  it("returns the stored state when it belongs to the current key", () => {
    expect(selectExplanationState(previous, previous.key)).toBe(previous);
  });

  it("reports loading while the stored explanation belongs to an older key", () => {
    expect(selectExplanationState(previous, '{"area":50}')).toEqual({
      explanation: null,
      loading: true,
      error: null,
    });
  });
});
