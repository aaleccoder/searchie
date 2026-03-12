import type { ShortcutPanelDescriptor } from "@/lib/panel-contract";
import type { SettingsSearchEntry } from "@/plugins/core/internal/settings-search";
import type { AppActionItem, InstalledApp, NavigationItem, PanelCommandSuggestion } from "./types";
import { supportsRunAsAdmin } from "./helpers";

export function buildInjectedPanelSuggestions(
  commandQuery: string,
  panels: ShortcutPanelDescriptor[],
): PanelCommandSuggestion[] {
  const queryForFilter = commandQuery.trim().toLowerCase();
  const suggestions: PanelCommandSuggestion[] = [];

  for (const panel of panels) {
    if (panel.isDefault || !panel.appsLauncherIntegration?.injectAsApp) {
      continue;
    }

    const mode = panel.searchIntegration?.activationMode ?? "immediate";
    if (mode !== "result-item") {
      continue;
    }

    const match = panel.matcher(commandQuery);
    if (match.matches) {
      suggestions.push({
        id: `panel-command:${panel.id}`,
        panel,
        commandQuery: match.commandQuery,
        label: panel.name,
      });
      continue;
    }

    if (!queryForFilter) {
      suggestions.push({
        id: `panel-command:${panel.id}`,
        panel,
        commandQuery: queryForFilter,
        label: panel.name,
      });
      continue;
    }

    const aliasMatch = panel.aliases.some((alias) => alias.toLowerCase().includes(queryForFilter));
    const nameMatch = panel.name.toLowerCase().includes(queryForFilter);
    if (aliasMatch || nameMatch) {
      suggestions.push({
        id: `panel-command:${panel.id}`,
        panel,
        commandQuery,
        label: panel.name,
      });
    }
  }

  return suggestions.slice(0, 8);
}

export function buildNavigationList(args: {
  allApps: InstalledApp[];
  searchResults: InstalledApp[];
  debouncedQuery: string;
  injectedPanelSuggestions: PanelCommandSuggestion[];
  injectedSettingsResults: SettingsSearchEntry[];
}): NavigationItem[] {
  const source = (args.debouncedQuery.trim() ? args.searchResults : args.allApps).slice(0, 72);
  const items: NavigationItem[] = source.map((app) => ({
    id: app.id,
    kind: "app",
    app,
  }));

  const settingsItems: NavigationItem[] = args.injectedSettingsResults.map((setting) => ({
    id: `setting:${setting.id}`,
    kind: "setting",
    setting,
  }));

  if (settingsItems.length > 0) {
    if (items.length > 0) {
      items.splice(1, 0, ...settingsItems);
    } else {
      items.push(...settingsItems);
    }
  }

  if (args.injectedPanelSuggestions.length > 0) {
    const injectedItems: NavigationItem[] = args.injectedPanelSuggestions.map((suggestion) => ({
      id: suggestion.id,
      kind: "panel-command",
      command: suggestion,
    }));

    if (items.length > 0) {
      items.splice(1, 0, ...injectedItems);
    } else {
      items.push(...injectedItems);
    }
  }

  return items;
}

export function buildAppActions(selectedApp: InstalledApp | null): AppActionItem[] {
  if (!selectedApp) {
    return [];
  }

  const canRunAsAdmin = supportsRunAsAdmin(selectedApp);

  return [
    {
      id: "open",
      label: "Open App",
      hint: "Launch normally",
    },
    {
      id: "run-as-admin",
      label: "Run As Administrator",
      hint: canRunAsAdmin ? "Elevated launch" : "Not supported for this app type",
      disabled: !canRunAsAdmin,
    },
    {
      id: "uninstall",
      label: "Uninstall App",
      hint: selectedApp.uninstallCommand ? "Run uninstaller" : "Not available",
      disabled: !selectedApp.uninstallCommand,
    },
    {
      id: "properties",
      label: "Open Properties",
      hint: "Windows file properties",
    },
    {
      id: "open-location",
      label: "Open Install Location",
      hint: selectedApp.installLocation ? "Open install folder" : "Try app folder",
    },
  ];
}
