import type { CorePluginDescriptor } from "@/lib/plugin-contract";
import { buildUtilityPanels } from "@/components/panels/utilities";

export function createCoreUtilitiesPlugin(): CorePluginDescriptor {
  return {
    id: "core.utilities",
    name: "Core Utilities",
    version: "0.1.0",
    permissions: ["files.search", "files.open"],
    panels: buildUtilityPanels(),
  };
}
