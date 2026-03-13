import { describe, expect, it } from "vitest";
import { evaluateExpression } from "@/lib/utilities/calc-engine";

describe("evaluateExpression", () => {
  it("evaluates basic math operations and precedence", () => {
    expect(evaluateExpression("2+2")).toBe(4);
    expect(evaluateExpression("2+2*3")).toBe(8);
    expect(evaluateExpression("(2+2)*3")).toBe(12);
    expect(evaluateExpression("10/4")).toBe(2.5);
  });

  it("supports whitespace and decimal values", () => {
    expect(evaluateExpression(" 3.5 + 1.25 ")).toBe(4.75);
  });

  it("throws for invalid expressions", () => {
    expect(() => evaluateExpression("2++2")).toThrow(/invalid/i);
    expect(() => evaluateExpression("foo")).toThrow(/invalid/i);
  });
});
