import { describe, expect, it } from "vitest";
import { createPanelRegistry } from "@/lib/panel-registry";
import { buildSettingsSearchPanels } from "../descriptors";

describe("settings-search panel registration", () => {
  it("registers msettings aliases", () => {
    const registry = createPanelRegistry();
    for (const panel of buildSettingsSearchPanels()) {
      registry.register(panel);
    }

    expect(registry.find("msettings camera")?.panel.id).toBe("settings-search");
    expect(registry.find("wsettings privacy")?.panel.id).toBe("settings-search");
  });
});
