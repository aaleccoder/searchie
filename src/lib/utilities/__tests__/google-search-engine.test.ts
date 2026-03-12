import { describe, expect, it } from "vitest";
import {
  buildGoogleSearchUrl,
  buildGoogleSuggestUrl,
  normalizeGoogleQuery,
  parseGoogleSuggestResponse,
} from "@/lib/utilities/google-search-engine";

describe("google-search-engine", () => {
  it("normalizes search query", () => {
    expect(normalizeGoogleQuery("  hello world ")).toBe("hello world");
  });

  it("builds google search url", () => {
    expect(buildGoogleSearchUrl("hello world")).toBe(
      "https://www.google.com/search?q=hello%20world",
    );
  });

  it("builds google search url for empty query", () => {
    expect(buildGoogleSearchUrl(" ")).toBe("https://www.google.com/search?q=");
  });

  it("builds google suggest url", () => {
    expect(buildGoogleSuggestUrl("hello world")).toBe(
      "https://suggestqueries.google.com/complete/search?client=firefox&q=hello%20world",
    );
  });

  it("parses google suggest response", () => {
    const payload = ["hello", ["hello world", "hello kitty", "hello world"], []];
    expect(parseGoogleSuggestResponse(payload)).toEqual(["hello world", "hello kitty"]);
  });

  it("returns empty list for invalid payload", () => {
    expect(parseGoogleSuggestResponse({})).toEqual([]);
    expect(parseGoogleSuggestResponse(["hello", "invalid"])).toEqual([]);
  });
});
