import type { PanelCommandScope } from "@/lib/tauri-commands";

export const launcherCommandScope: PanelCommandScope = {
  pluginId: "core.apps",
  id: "launcher",
  capabilities: [
    "apps.list",
    "apps.search",
    "apps.launch",
    "apps.launchAdmin",
    "apps.uninstall",
    "apps.properties",
    "apps.location",
    "apps.icon",
    "settings.read",
  ],
};
