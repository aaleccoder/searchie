import { describe, expect, it } from "vitest";
import { convertValue, parseConversionQuery } from "@/lib/utilities/conversion-engine";

describe("parseConversionQuery", () => {
  it("parses english and spanish-style connectors", () => {
    expect(parseConversionQuery("10 km to mi")).toEqual({ value: 10, fromUnit: "km", toUnit: "mi" });
    expect(parseConversionQuery("10 km a mi")).toEqual({ value: 10, fromUnit: "km", toUnit: "mi" });
    expect(parseConversionQuery("100 c para f")).toEqual({ value: 100, fromUnit: "c", toUnit: "f" });
  });

  it("returns null when query is not parseable", () => {
    expect(parseConversionQuery("km to mi")).toBeNull();
    expect(parseConversionQuery("convert this")).toBeNull();
  });
});

describe("convertValue", () => {
  it("converts length and temperature values", () => {
    expect(convertValue({ value: 10, fromUnit: "km", toUnit: "mi" })).toBeCloseTo(6.21371, 5);
    expect(convertValue({ value: 100, fromUnit: "c", toUnit: "f" })).toBe(212);
    expect(convertValue({ value: 32, fromUnit: "f", toUnit: "c" })).toBe(0);
  });

  it("throws when conversion pair is unsupported", () => {
    expect(() => convertValue({ value: 2, fromUnit: "kg", toUnit: "c" })).toThrow(/unsupported/i);
  });
});
