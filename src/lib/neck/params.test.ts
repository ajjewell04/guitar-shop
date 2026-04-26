import { describe, it, expect } from "vitest";
import {
  normalizeNeckParams,
  NeckParamsSchema,
  DEFAULT_NECK_PARAMS,
} from "@/lib/neck/params";

describe("normalizeNeckParams", () => {
  it("returns DEFAULT_NECK_PARAMS when called with an empty object", () => {
    expect(normalizeNeckParams({})).toEqual(DEFAULT_NECK_PARAMS);
  });

  it("clamps heelLengthMm up to the minimum (12)", () => {
    const result = normalizeNeckParams({ heelLengthMm: 5 });
    expect(result.heelLengthMm).toBe(12);
  });

  it("clamps heelLengthMm down to the maximum (40)", () => {
    const result = normalizeNeckParams({ heelLengthMm: 100 });
    expect(result.heelLengthMm).toBe(40);
  });

  it("passes through a heelLengthMm value within range unchanged", () => {
    const result = normalizeNeckParams({ heelLengthMm: 24 });
    expect(result.heelLengthMm).toBe(24);
  });

  it("forces fingerboardRadiusEndIn to equal fingerboardRadiusStartIn when singleRadius mode", () => {
    const result = normalizeNeckParams({
      fingerboardRadiusMode: "single",
      fingerboardRadiusStartIn: 12,
      fingerboardRadiusEndIn: 16,
    });
    expect(result.fingerboardRadiusEndIn).toBe(12);
  });

  it("preserves independent fingerboardRadiusEndIn when compound mode", () => {
    const result = normalizeNeckParams({
      fingerboardRadiusMode: "compound",
      fingerboardRadiusStartIn: 9.5,
      fingerboardRadiusEndIn: 14,
    });
    expect(result.fingerboardRadiusEndIn).toBe(14);
  });
});

describe("NeckParamsSchema", () => {
  it("rejects fretCount below the minimum (20)", () => {
    expect(() => NeckParamsSchema.parse({ fretCount: 19 })).toThrow();
  });

  it("rejects scaleLengthIn above the maximum (27)", () => {
    expect(() => NeckParamsSchema.parse({ scaleLengthIn: 28 })).toThrow();
  });

  it("rejects scaleLengthIn below the minimum (22.5)", () => {
    expect(() => NeckParamsSchema.parse({ scaleLengthIn: 22 })).toThrow();
  });

  it("accepts all default values", () => {
    expect(() => NeckParamsSchema.parse({})).not.toThrow();
  });
});
