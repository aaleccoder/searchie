import { defineCorePlugin } from "@/plugins/sdk";
import type { CorePluginDescriptor } from "@/lib/plugin-contract";

export function createCorePluginSettingsPlugin(): CorePluginDescriptor {
  return defineCorePlugin({
    id: "core.plugin-settings",
    name: "Core Plugin Settings",
    version: "0.1.0",
    permissions: [],
    panels: [],
    settings: (defineConfig) => [
      
    ],
  });
}
