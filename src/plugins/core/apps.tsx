import type { CorePluginDescriptor } from "@/lib/plugin-contract";
import { buildAppsPanels } from "./internal/apps/descriptors";

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
