import type { ShortcutPanelDescriptor } from "@/lib/panel-contract";
import { createPrefixAliasMatcher } from "@/lib/panel-matchers";
import { AppsLauncherPanel } from "@/components/panels/apps/apps-launcher-panel";
import { APPS_ALIASES, flattenAliases } from "@/components/panels/apps/aliases";

function createAppsPanel(): ShortcutPanelDescriptor {
  const aliases = flattenAliases(APPS_ALIASES);

  return {
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
      { keys: "Escape", description: "Focus launcher input" },
    ],
    matcher: createPrefixAliasMatcher(aliases),
    component: ({
      commandQuery,
      registerInputArrowDownHandler,
      registerInputEnterHandler,
      focusLauncherInput,
      clearLauncherInput,
      closeLauncherWindow,
      activatePanelSession,
    }) => (
      <AppsLauncherPanel
        commandQuery={commandQuery}
        registerInputArrowDownHandler={registerInputArrowDownHandler}
        registerInputEnterHandler={registerInputEnterHandler}
        focusLauncherInput={focusLauncherInput}
        clearLauncherInput={clearLauncherInput}
        closeLauncherWindow={closeLauncherWindow}
        activatePanelSession={activatePanelSession}
      />
    ),
  };
}

export function buildAppsPanels(): ShortcutPanelDescriptor[] {
  return [createAppsPanel()];
}
