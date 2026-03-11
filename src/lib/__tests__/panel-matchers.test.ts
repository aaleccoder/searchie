import { describe, expect, it } from "vitest";
import { createPrefixAliasMatcher } from "@/lib/panel-matchers";

describe("createPrefixAliasMatcher", () => {
  const matcher = createPrefixAliasMatcher(["cl", "clipboard"]);

  it("matches exact alias", () => {
    expect(matcher("cl")).toEqual({ matches: true, commandQuery: "" });
    expect(matcher("clipboard")).toEqual({ matches: true, commandQuery: "" });
  });

  it("matches alias with command query", () => {
    expect(matcher("cl hello")).toEqual({ matches: true, commandQuery: "hello" });
    expect(matcher("clipboard world")).toEqual({ matches: true, commandQuery: "world" });
  });

  it("is case-insensitive and trims spaces", () => {
    expect(matcher("  CL   test   ")).toEqual({ matches: true, commandQuery: "test" });
  });

  it("does not match unrelated input", () => {
    expect(matcher("calendar")).toEqual({ matches: false, commandQuery: "" });
    expect(matcher("")) .toEqual({ matches: false, commandQuery: "" });
  });
});
