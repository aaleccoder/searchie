import { describe, expect, it } from "vitest";
import { extractFirstColorToken } from "@/lib/utilities/color-preview";

describe("extractFirstColorToken", () => {
  it("detects hex colors", () => {
    expect(extractFirstColorToken("brand #22c55e background")).toBe("#22c55e");
  });

  it("detects rgb and oklch function colors", () => {
    expect(extractFirstColorToken("accent rgb(34, 197, 94) and oklch(0.72 0.14 151)")).toBe(
      "rgb(34, 197, 94)",
    );
  });

  it("returns null for text without a valid color token", () => {
    expect(extractFirstColorToken("just plain clipboard text")).toBeNull();
  });
});
