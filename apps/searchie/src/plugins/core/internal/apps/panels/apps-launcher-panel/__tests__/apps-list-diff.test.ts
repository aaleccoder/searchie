import { describe, expect, it } from "vitest";
import { mergeAppsList } from "../apps-list-diff";
import type { InstalledApp } from "../types";

function app(id: string, name: string): InstalledApp {
  return {
    id,
    name,
    launchPath: `C:/${id}.exe`,
    launchArgs: [],
    source: "desktop",
  };
}

describe("mergeAppsList", () => {
  it("preserves existing order while updating entries", () => {
    const previous = [app("a", "Alpha"), app("b", "Beta")];
    const next = [app("b", "Beta Updated"), app("a", "Alpha Updated")];

    const merged = mergeAppsList(previous, next);

    expect(merged.map((entry) => entry.id)).toEqual(["a", "b"]);
    expect(merged[0]?.name).toBe("Alpha Updated");
    expect(merged[1]?.name).toBe("Beta Updated");
  });

  it("removes missing entries and appends new entries in incoming order", () => {
    const previous = [app("a", "Alpha"), app("b", "Beta"), app("c", "Gamma")];
    const next = [app("b", "Beta"), app("d", "Delta")];

    const merged = mergeAppsList(previous, next);

    expect(merged.map((entry) => entry.id)).toEqual(["b", "d"]);
  });

  it("returns incoming list when previous is empty", () => {
    const next = [app("x", "Xray")];
    expect(mergeAppsList([], next)).toEqual(next);
  });
});
