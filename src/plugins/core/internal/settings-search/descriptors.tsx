import { Settings2 } from "lucide-react";
import type { ShortcutPanelDescriptor } from "@/lib/panel-contract";
import { createPrefixAliasMatcher } from "@/lib/panel-matchers";
import { definePluginPanel } from "@/plugins/sdk";
import { SETTINGS_SEARCH_ALIAS_LIST } from "./aliases";
import { SettingsSearchPanel } from "./panels/settings-search-panel";

function createSettingsSearchPanel(): ShortcutPanelDescriptor {
  return definePluginPanel({
    id: "settings-search",
    name: "Windows Settings",
    aliases: SETTINGS_SEARCH_ALIAS_LIST,
    commandIcon: Settings2,
    capabilities: [],
    priority: 29,
    searchIntegration: {
      activationMode: "immediate",
      placeholder: "Search Windows settings...",
      exitOnEscape: true,
    },
    shortcuts: [
      { keys: "Enter", description: "Open selected settings URI" },
      { keys: "ArrowUp/ArrowDown", description: "Navigate setting results" },
      { keys: "Escape", description: "Back to launcher commands" },
    ],
    matcher: createPrefixAliasMatcher(SETTINGS_SEARCH_ALIAS_LIST),
    component: ({ commandQuery }) => <SettingsSearchPanel commandQuery={commandQuery} />,
  });
}

export function buildSettingsSearchPanels(): ShortcutPanelDescriptor[] {
  return [createSettingsSearchPanel()];
}
