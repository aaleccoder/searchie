import { describe, expect, it } from "vitest";
import { createPanelRegistry } from "@/lib/panel-registry";
import { createPluginRegistry } from "@/lib/plugin-registry";
import { loadRuntimePlugins } from "@/plugins/runtime";

describe("runtime plugin registry integration", () => {
  it("registers runtime plugin panels and resolves color aliases", async () => {
    const pluginRegistry = createPluginRegistry();
    const panelRegistry = createPanelRegistry();

    const runtimePlugins = await loadRuntimePlugins();
    for (const plugin of runtimePlugins) {
      pluginRegistry.register(plugin);
    }

    for (const panel of pluginRegistry.listPanels()) {
      panelRegistry.register(panel);
    }

    expect(panelRegistry.find("color #22c55e")?.panel.id).toBe("utilities-color");
    expect(panelRegistry.find("couleur rgb(255 0 0)")?.panel.id).toBe("utilities-color");
  }, 15_000);
});
