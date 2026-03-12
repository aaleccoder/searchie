import { CircleHelp, Settings2 } from "lucide-react";
import type { CorePluginDescriptor } from "@/lib/plugin-contract";
import type { ShortcutPanelDescriptor } from "@/lib/panel-contract";
import { createPrefixAliasMatcher } from "@/lib/panel-matchers";
import { SettingsShortcutPanel } from "./internal/system/panels/settings-shortcut-panel";
import { HotkeysShortcutPanel } from "./internal/system/panels/hotkeys-shortcut-panel";
import { buildSystemControlPanels } from "./internal/system";

function createSettingsPanel(): ShortcutPanelDescriptor {
  return {
    id: "settings",
    name: "Settings",
    aliases: ["settings", "set", "prefs", "preferences"],
    commandIcon: Settings2,
    capabilities: ["settings.read", "settings.write", "window.mode"],
    priority: 35,
    searchIntegration: {
      activationMode: "result-item",
      placeholder: "Search settings...",
      exitOnEscape: true,
    },
    shortcuts: [{ keys: "Escape", description: "Back to launcher commands" }],
    matcher: createPrefixAliasMatcher(["settings", "set", "prefs", "preferences"]),
    component: ({ commandQuery }) => <SettingsShortcutPanel commandQuery={commandQuery} />,
  };
}

function createHotkeysPanel(): ShortcutPanelDescriptor {
  return {
    id: "hotkeys",
    name: "Hotkeys",
    aliases: ["?", "help", "hotkeys", "keys", "shortcuts"],
    commandIcon: CircleHelp,
    capabilities: [],
    priority: 34,
    searchIntegration: {
      activationMode: "result-item",
      placeholder: "Search hotkeys...",
      exitOnEscape: true,
    },
    shortcuts: [{ keys: "Escape", description: "Back to launcher commands" }],
    matcher: createPrefixAliasMatcher(["?", "help", "hotkeys", "keys", "shortcuts"]),
    component: ({ commandQuery }) => <HotkeysShortcutPanel commandQuery={commandQuery} />,
  };
}

export function createCoreSystemPlugin(): CorePluginDescriptor {
  return {
    id: "core.system",
    name: "Core System",
    version: "0.1.0",
    permissions: [
      "settings.read",
      "settings.write",
      "window.mode",
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
    panels: [createSettingsPanel(), createHotkeysPanel(), ...buildSystemControlPanels()],
  };
}
