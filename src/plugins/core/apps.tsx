import type { CorePluginDescriptor } from "@/lib/plugin-contract";
import { buildAppsPanels } from "@/plugins/core/apps-panels";

export function createCoreAppsPlugin(): CorePluginDescriptor {
  return {
    id: "core.apps",
    name: "Core Apps",
    version: "0.1.0",
    permissions: [
      "apps.list",
      "apps.search",
      "apps.launch",
      "apps.launchAdmin",
      "apps.uninstall",
      "apps.properties",
      "apps.location",
      "apps.icon",
    ],
    panels: buildAppsPanels(),
  };
}
