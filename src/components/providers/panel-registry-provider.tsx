import * as React from "react";
import { CircleHelp, Settings2 } from "lucide-react";
import { buildAppsPanels } from "@/components/panels/apps";
import { clipboardShortcutPanel } from "@/components/panels/clipboard-shortcut-panel";
import { HotkeysShortcutPanel } from "@/components/panels/hotkeys-shortcut-panel";
import { SettingsShortcutPanel } from "@/components/panels/settings-shortcut-panel";
import { buildUtilityPanels } from "@/components/panels/utilities";
import type { ShortcutPanelDescriptor } from "@/lib/panel-contract";
import { createPrefixAliasMatcher } from "@/lib/panel-matchers";
import { createPanelRegistry, PanelRegistryContext } from "@/lib/panel-registry";

type PanelRegistryProviderProps = {
  children: React.ReactNode;
};

const settingsShortcutPanel: ShortcutPanelDescriptor = {
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

const hotkeysShortcutPanel: ShortcutPanelDescriptor = {
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

export function PanelRegistryProvider({ children }: PanelRegistryProviderProps) {
  const [registry] = React.useState(() => {
    const nextRegistry = createPanelRegistry({
      onAliasCollision: (message) => {
        console.warn(message);
      },
    });

    nextRegistry.register(clipboardShortcutPanel);
    nextRegistry.register(settingsShortcutPanel);
    nextRegistry.register(hotkeysShortcutPanel);
    for (const appsPanel of buildAppsPanels()) {
      nextRegistry.register(appsPanel);
    }
    for (const utilityPanel of buildUtilityPanels()) {
      nextRegistry.register(utilityPanel);
    }
    return nextRegistry;
  });

  return <PanelRegistryContext.Provider value={registry}>{children}</PanelRegistryContext.Provider>;
}
