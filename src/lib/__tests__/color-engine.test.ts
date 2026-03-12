import { describe, expect, it } from "vitest";
import { convertColorInput } from "@/lib/utilities/color-engine";

describe("convertColorInput", () => {
  it("converts HEX input into rgb, oklch, and hsl", () => {
    const result = convertColorInput("#ff0000");
    expect(result).not.toBeNull();
    expect(result?.hex).toBe("#FF0000");
    expect(result?.rgb).toBe("rgb(255 0 0)");
    expect(result?.oklch).toContain("oklch(");
    expect(result?.hsl).toBe("hsl(0 100% 50%)");
  });

  it("converts RGB input into canonical HEX", () => {
    const result = convertColorInput("rgb(34, 197, 94)");
    expect(result).not.toBeNull();
    expect(result?.hex).toBe("#22C55E");
    expect(result?.rgb).toBe("rgb(34 197 94)");
  });

  it("converts OKLCH input into rgb and HEX", () => {
    const result = convertColorInput("oklch(62.8% 0.258 29.23)");
    expect(result).not.toBeNull();
    expect(result?.rgb.startsWith("rgb(")).toBe(true);
    expect(result?.hex.startsWith("#")).toBe(true);
  });

  it("returns null for invalid input", () => {
    expect(convertColorInput("not-a-color")).toBeNull();
    expect(convertColorInput("rgb(900 0 0)")).toBeNull();
  });
});