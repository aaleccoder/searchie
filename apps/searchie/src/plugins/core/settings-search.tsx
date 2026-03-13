import type { CorePluginDescriptor } from "@/lib/plugin-contract";
import { buildSettingsSearchPanels } from "@/plugins/core/internal/settings-search";

export function createCoreSettingsSearchPlugin(): CorePluginDescriptor {
  return {
    id: "core.settings-search",
    name: "Core Settings Search",
    version: "0.1.0",
    permissions: [],
    panels: buildSettingsSearchPanels(),
  };
}
