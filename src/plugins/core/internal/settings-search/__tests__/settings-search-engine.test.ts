import { describe, expect, it } from "vitest";
import {
  extractSettingsAliasQuery,
  normalizeSettingsCatalog,
  scoreSettingsMatch,
  searchSettingsEntries,
} from "../lib/settings-search-engine";

describe("settings-search engine", () => {
  it("normalizes valid catalog rows and skips invalid rows", () => {
    const catalog = normalizeSettingsCatalog([
      { settingsPage: "Camera", uri: "ms-settings:privacy-webcam" },
      { settingsPage: "General", uri: ["ms-settings:privacy", "ms-settings:privacy-general"] },
      { settingsPage: "Invalid", uri: [] },
      { settingsPage: " ", uri: "ms-settings:sound" },
    ]);

    expect(catalog).toEqual([
      {
        id: "setting-0",
        settingsPage: "Camera",
        uris: ["ms-settings:privacy-webcam"],
        searchText: "camera ms-settings:privacy-webcam",
      },
      {
        id: "setting-1",
        settingsPage: "General",
        uris: ["ms-settings:privacy", "ms-settings:privacy-general"],
        searchText: "general ms-settings:privacy ms-settings:privacy-general",
      },
    ]);
  });

  it("extracts msettings prefixed query", () => {
    expect(extractSettingsAliasQuery("msettings privacy", ["msettings"])).toEqual({
      usedAlias: true,
      query: "privacy",
    });
    expect(extractSettingsAliasQuery("msettings", ["msettings"])).toEqual({
      usedAlias: true,
      query: "",
    });
    expect(extractSettingsAliasQuery("privacy", ["msettings"])).toEqual({
      usedAlias: false,
      query: "privacy",
    });
  });

  it("scores exact page and URI matches higher", () => {
    const exact = scoreSettingsMatch("camera", {
      id: "setting-0",
      settingsPage: "Camera",
      uris: ["ms-settings:privacy-webcam"],
      searchText: "camera ms-settings:privacy-webcam",
    });

    const partial = scoreSettingsMatch("cam", {
      id: "setting-1",
      settingsPage: "Camera Settings",
      uris: ["ms-settings:camera"],
      searchText: "camera settings ms-settings:camera",
    });

    expect(exact).toBeGreaterThan(partial);
  });

  it("returns ranked settings results and respects limit", () => {
    const catalog = normalizeSettingsCatalog([
      { settingsPage: "Camera", uri: "ms-settings:privacy-webcam" },
      { settingsPage: "Microphone", uri: "ms-settings:privacy-microphone" },
      { settingsPage: "Sound", uri: "ms-settings:sound" },
    ]);

    const results = searchSettingsEntries(catalog, "privacy", 2);

    expect(results).toHaveLength(2);
    expect(results[0]?.settingsPage).toBe("Camera");
    expect(results[1]?.settingsPage).toBe("Microphone");
  });

  it("returns empty results for unsupported catalog payload", () => {
    expect(normalizeSettingsCatalog(null)).toEqual([]);
    expect(normalizeSettingsCatalog({})).toEqual([]);
  });
});
