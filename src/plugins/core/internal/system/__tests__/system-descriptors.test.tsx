import { describe, expect, it } from "vitest";
import { buildSystemControlPanels, buildSystemDirectCommands } from "@/plugins/core/internal/system";

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

  it("registers actionable brightness direct commands", () => {
    const commands = buildSystemDirectCommands();
    const brightnessCommand = commands.find((command) => command.id === "system-brightness-action");

    expect(brightnessCommand).toBeTruthy();
    expect(brightnessCommand?.matcher("brightness up")).toEqual({
      matches: true,
      commandQuery: "up",
    });
    expect(brightnessCommand?.matcher("brightness 55")).toEqual({
      matches: true,
      commandQuery: "55",
    });
    expect(brightnessCommand?.matcher("brightness")).toEqual({
      matches: false,
      commandQuery: "",
    });
  });
});
