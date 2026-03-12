import type { ShortcutPanelDescriptor } from "@/lib/panel-contract";
import { definePluginPanel } from "@/plugins/sdk";
import { createPrefixAliasMatcher } from "@/lib/panel-matchers";

import { APPS_ALIASES, flattenAliases } from "./aliases";
import { AppsLauncherPanel } from "./panels/apps-launcher-panel";

function createAppsPanel(): ShortcutPanelDescriptor {
  const aliases = flattenAliases(APPS_ALIASES);

  return definePluginPanel({
    id: "apps-launcher",
    name: "Apps",
    aliases,
    isDefault: true,
    capabilities: [
      "apps.list",
      "apps.search",
      "apps.launch",
      "apps.launchAdmin",
      "apps.uninstall",
      "apps.properties",
      "apps.location",
      "apps.icon",
    ],
    priority: 20,
    searchIntegration: {
      activationMode: "immediate",
      placeholder: "Search apps...",
      exitOnEscape: true,
    },
    shortcuts: [
      { keys: "Enter", description: "Open selected app" },
      { keys: "ArrowUp/ArrowDown", description: "Navigate app list" },
      { keys: "ArrowRight", description: "Open app actions" },
      { keys: "ArrowLeft", description: "Back to app list" },
      { keys: "Alt+K", description: "Open footer extra actions" },
      { keys: "Alt+R/Alt+U/Alt+P/Alt+L", description: "Run app extra action directly" },
      { keys: "Escape", description: "Focus launcher input" },
    ],
    matcher: createPrefixAliasMatcher(aliases),
    component: ({
      commandQuery,
      registerInputArrowDownHandler,
      registerInputEnterHandler,
      registerPanelFooter,
      focusLauncherInput,
      clearLauncherInput,
      closeLauncherWindow,
      activatePanelSession,
    }) => (
      <AppsLauncherPanel
        commandQuery={commandQuery}
        registerInputArrowDownHandler={registerInputArrowDownHandler}
        registerInputEnterHandler={registerInputEnterHandler}
        registerPanelFooter={registerPanelFooter}
        focusLauncherInput={focusLauncherInput}
        clearLauncherInput={clearLauncherInput}
        closeLauncherWindow={closeLauncherWindow}
        activatePanelSession={activatePanelSession}
      />
    ),
  });
}

export function buildAppsPanels(): ShortcutPanelDescriptor[] {
  return [createAppsPanel()];
} 