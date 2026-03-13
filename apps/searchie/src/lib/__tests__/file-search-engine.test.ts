import { describe, expect, it } from "vitest";
import {
  buildSearchRequest,
  parseFileSearchQuery,
  rankFileSearchResults,
  type FileSearchCandidate,
} from "@/lib/utilities/file-search-engine";

describe("parseFileSearchQuery", () => {
  it("parses plain query text", () => {
    expect(parseFileSearchQuery("invoice")).toEqual({
      term: "invoice",
      rootPath: undefined,
    });
  });

  it("parses root path with in syntax", () => {
    expect(parseFileSearchQuery("report in C:\\Users\\ardev\\Documents")).toEqual({
      term: "report",
      rootPath: "C:\\Users\\ardev\\Documents",
    });
  });

  it("returns null for empty query", () => {
    expect(parseFileSearchQuery("   ")).toBeNull();
  });
});

describe("buildSearchRequest", () => {
  it("applies limit clamping", () => {
    expect(buildSearchRequest("notes", 1000)).toEqual({
      query: "notes",
      limit: 200,
      root: undefined,
    });
  });

  it("throws for invalid input", () => {
    expect(() => buildSearchRequest(" ")).toThrow(/query/i);
  });
});

describe("rankFileSearchResults", () => {
  it("prioritizes exact filename starts and shorter paths", () => {
    const ranked = rankFileSearchResults("read", [
      { path: "C:/repo/README.md", fileName: "README.md" },
      { path: "C:/repo/docs/architecture/read-model.md", fileName: "read-model.md" },
      { path: "C:/repo/src/components/breadcrumb.tsx", fileName: "breadcrumb.tsx" },
    ]);

    expect(ranked[0]?.fileName).toBe("README.md");
    expect(ranked[1]?.fileName).toBe("read-model.md");
    expect(ranked.at(-1)?.fileName).toBe("breadcrumb.tsx");
  });

  it("returns empty for empty candidate list", () => {
    const ranked = rankFileSearchResults("search", [] as FileSearchCandidate[]);
    expect(ranked).toEqual([]);
  });
});
