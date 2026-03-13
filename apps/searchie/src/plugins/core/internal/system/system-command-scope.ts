import type { PanelCommandScope } from "@/lib/tauri-commands";

export const systemCommandScope: PanelCommandScope = {
  pluginId: "core.system",
  id: "system-controls",
  capabilities: [
    "system.media",
    "system.volume",
    "system.brightness",
    "system.wifi",
    "system.bluetooth",
    "system.airplane",
    "system.power",
    "system.hotspot",
    "system.settings",
  ],
};
