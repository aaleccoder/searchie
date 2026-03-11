import { describe, expect, it } from "vitest";
import { filterGlyphEntries, GLYPH_ENTRIES, parseGlyphPickerQuery } from "@/lib/utilities/glyph-picker-engine";

describe("parseGlyphPickerQuery", () => {
  it("parses category and search text", () => {
    expect(parseGlyphPickerQuery("emoji smile")).toEqual({ category: "emoji", searchTerm: "smile" });
    expect(parseGlyphPickerQuery("emoticon shrug")).toEqual({ category: "emoticon", searchTerm: "shrug" });
    expect(parseGlyphPickerQuery("symbol arrow")).toEqual({ category: "symbol", searchTerm: "arrow" });
  });

  it("defaults to all category for plain searches", () => {
    expect(parseGlyphPickerQuery("heart")).toEqual({ category: "all", searchTerm: "heart" });
    expect(parseGlyphPickerQuery("   ")).toEqual({ category: "all", searchTerm: "" });
  });
});

describe("filterGlyphEntries", () => {
  it("filters by category and query", () => {
    const emojiResults = filterGlyphEntries(GLYPH_ENTRIES, { category: "emoji", searchTerm: "smile" });
    expect(emojiResults.some((entry) => entry.value === "😊")).toBe(true);
    expect(emojiResults.every((entry) => entry.kind === "emoji")).toBe(true);

    const emoticonResults = filterGlyphEntries(GLYPH_ENTRIES, {
      category: "emoticon",
      searchTerm: "shrug",
    });
    expect(emoticonResults.map((entry) => entry.value)).toContain("¯\\_(ツ)_/¯");
  });

  it("returns empty list when nothing matches", () => {
    const results = filterGlyphEntries(GLYPH_ENTRIES, { category: "symbol", searchTerm: "not-a-real-token" });
    expect(results).toEqual([]);
  });
});
