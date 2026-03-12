import { describe, expect, it } from "vitest";
import { buildSystemControlPanels } from "@/plugins/core/internal/system";

describe("buildSystemControlPanels", () => {
  it("registers all expected system panels", () => {
    const panels = buildSystemControlPanels();
    const ids = panels.map((panel) => panel.id);

    expect(ids).toEqual(
      expect.arrayContaining([
        "system-media",
        "system-volume",
        "system-brightness",
        "system-wifi",
        "system-bluetooth",
        "system-airplane",
        "system-hotspot",
        "system-power",
        "system-settings-shortcuts",
      ]),
    );
  });

  it("injects panels as apps launcher commands", () => {
    const panels = buildSystemControlPanels();
    for (const panel of panels) {
      expect(panel.appsLauncherIntegration?.injectAsApp).toBe(true);
      expect(panel.searchIntegration?.activationMode).toBe("result-item");
    }
  });

  it("supports alias matching for system volume", () => {
    const volumePanel = buildSystemControlPanels().find((panel) => panel.id === "system-volume");
    expect(volumePanel).toBeTruthy();

    const result = volumePanel?.matcher("volume 65");
    expect(result?.matches).toBe(true);
    expect(result?.commandQuery).toBe("65");
  });
});
