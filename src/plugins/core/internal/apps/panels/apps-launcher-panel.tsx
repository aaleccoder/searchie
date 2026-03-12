import * as React from "react";
import { ArrowLeft, FolderOpen, Rocket, Settings2, Shield, Trash2, Wrench } from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import { useHotkey } from "@tanstack/react-hotkeys";
import {
  PanelAside,
  PanelButton,
  PanelContainer,
  PanelFlex,
  PanelFigureImage,
  PanelGrid,
  PanelInline,
  PanelList,
  PanelListItem,
  PanelMetaGrid,
  PanelParagraph,
  PanelScrollArea,
  PanelTooltip,
  PanelTooltipContent,
  PanelTooltipProvider,
  PanelTooltipTrigger,
} from "@/components/framework/panel-primitives";
import {
  createPluginBackendSdk,
  usePanelArrowDownBridge,
  usePanelEnterBridge,
  usePanelFooter,
  usePanelFooterControlsRef,
} from "@/plugins/sdk";
import type { PanelFooterConfig, ShortcutPanelDescriptor } from "@/lib/panel-contract";
import {
  cacheAppIcons,
  computeAppsIconFingerprint,
  ensureAppsIconCacheBucket,
  getCachedAppIcon,
  hasCachedAppIcon,
} from "@/lib/apps-icon-cache";
import { usePanelRegistry } from "@/lib/panel-registry";
import type { PanelCommandScope } from "@/lib/tauri-commands";
import {
  SETTINGS_SEARCH_ALIAS_LIST,
  extractSettingsAliasQuery,
  loadSettingsCatalog,
  searchSettingsEntries,
  type SettingsSearchEntry,
} from "@/plugins/core/internal/settings-search";

type InstalledApp = {
  id: string;
  name: string;
  launchPath: string;
  launchArgs: string[];
  iconPath?: string | null;
  version?: string | null;
  publisher?: string | null;
  installLocation?: string | null;
  uninstallCommand?: string | null;
  source: string;
};

type AppActionItem = {
  id: "open" | "run-as-admin" | "uninstall" | "properties" | "open-location";
  label: string;
  hint: string;
  disabled?: boolean;
};

type AppsLauncherPanelProps = {
  commandQuery: string;
  registerInputArrowDownHandler?: ((handler: (() => boolean | void) | null) => void) | undefined;
  registerInputEnterHandler?: ((handler: (() => boolean | void) | null) => void) | undefined;
  registerPanelFooter?: ((footer: PanelFooterConfig | null) => void) | undefined;
  focusLauncherInput?: (() => void) | undefined;
  clearLauncherInput?: (() => void) | undefined;
  closeLauncherWindow?: (() => void) | undefined;
  activatePanelSession?: ((panel: ShortcutPanelDescriptor, nextQuery: string) => void) | undefined;
};

type PanelCommandSuggestion = {
  id: string;
  panel: ShortcutPanelDescriptor;
  commandQuery: string;
  label: string;
};

type NavigationItem =
  | {
      id: string;
      kind: "app";
      app: InstalledApp;
    }
  | {
      id: string;
      kind: "setting";
      setting: SettingsSearchEntry;
    }
  | {
      id: string;
      kind: "panel-command";
      command: PanelCommandSuggestion;
    };

  type NavigationMode = "list" | "actions";

const launcherCommandScope: PanelCommandScope = {
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

function supportsRunAsAdmin(app: InstalledApp): boolean {
  const source = app.source.toLowerCase();
  if (source === "uwp" || source === "startapps") {
    return false;
  }

  const launchPath = app.launchPath.toLowerCase();
  if (launchPath !== "explorer.exe") {
    return true;
  }

  return !app.launchArgs.some((arg) => arg.toLowerCase().includes("shell:appsfolder\\"));
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function isEditableElement(element: Element | null): boolean {
  if (!element) {
    return false;
  }

  if (element instanceof HTMLTextAreaElement) {
    return true;
  }

  if (element instanceof HTMLInputElement) {
    const type = element.type.toLowerCase();
    return type !== "button" && type !== "checkbox" && type !== "radio";
  }

  if (element instanceof HTMLElement) {
    return element.isContentEditable;
  }

  return false;
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = React.useState(value);

  React.useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timeout);
  }, [value, delayMs]);

  return debounced;
}

function AppIcon({ appId, cacheVersion }: { appId: string; cacheVersion: number }) {
  const [failed, setFailed] = React.useState(false);
  const src = getCachedAppIcon(appId);

  React.useEffect(() => {
    setFailed(false);
  }, [appId, cacheVersion]);

  if (!src || failed) {
    return (
      <PanelContainer
        surface="muted"
        radius="sm"
        style={{ width: 24, height: 24, display: "grid", placeItems: "center", flexShrink: 0 }}
      >
        <Rocket size={14} />
      </PanelContainer>
    );
  }

  return (
    <PanelFigureImage
      src={src}
      alt=""
      onError={() => setFailed(true)}
      loading="lazy"
      style={{ width: 24, height: 24, flexShrink: 0 }}
    />
  );
}

type SingleLineTooltipTextProps = {
  text: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  tone?: "default" | "muted";
  mono?: boolean;
};

function SingleLineTooltipText({ text, size = "sm", tone = "default", mono = false }: SingleLineTooltipTextProps) {
  return (
    <PanelTooltip>
      <PanelTooltipTrigger render={<PanelInline truncate size={size} tone={tone} mono={mono}>{text}</PanelInline>} />
      <PanelTooltipContent>{text}</PanelTooltipContent>
    </PanelTooltip>
  );
}

type DetailRowProps = {
  label: string;
  value: string;
};

function DetailRow({ label, value }: DetailRowProps) {
  return (
    <PanelMetaGrid>
      <PanelInline tone="muted" size="sm">{label}</PanelInline>
      <SingleLineTooltipText text={value} size="sm" />
    </PanelMetaGrid>
  );
}

export function AppsLauncherPanel({
  commandQuery,
  registerInputArrowDownHandler,
  registerInputEnterHandler,
  registerPanelFooter,
  focusLauncherInput,
  clearLauncherInput,
  closeLauncherWindow,
  activatePanelSession,
}: AppsLauncherPanelProps) {
  const backend = React.useMemo(() => createPluginBackendSdk(launcherCommandScope), []);
  const panelRegistry = usePanelRegistry();
  const deferredQuery = React.useDeferredValue(commandQuery);
  const debouncedQuery = useDebouncedValue(deferredQuery, 120);
  const [, startTransition] = React.useTransition();
  const [allApps, setAllApps] = React.useState<InstalledApp[]>([]);
  const [searchResults, setSearchResults] = React.useState<InstalledApp[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [busyActionId, setBusyActionId] = React.useState<AppActionItem["id"] | null>(null);
  const [selectedActionIndex, setSelectedActionIndex] = React.useState(0);
  const [navigationMode, setNavigationMode] = React.useState<NavigationMode>("list");
  const [iconCacheVersion, setIconCacheVersion] = React.useState(0);
  const [settingsCatalog, setSettingsCatalog] = React.useState<SettingsSearchEntry[]>([]);

  const itemRefs = React.useRef<Map<string, HTMLButtonElement>>(new Map());
  const actionRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const pendingIconIdsRef = React.useRef<Set<string>>(new Set());
  const listScrollHostRef = React.useRef<HTMLDivElement | null>(null);
  const { controlsRef: footerControlsRef, registerFooterControls } = usePanelFooterControlsRef();

  const getListScrollViewport = React.useCallback((): HTMLElement | null => {
    const host = listScrollHostRef.current;
    if (!host) {
      return null;
    }

    return host.querySelector<HTMLElement>("[data-slot='scroll-area-viewport']");
  }, []);

  const iconFingerprint = React.useMemo(() => computeAppsIconFingerprint(allApps), [allApps]);

  const refreshAllApps = React.useCallback(async () => {
    try {
      const apps = await backend.apps.listInstalledApps<InstalledApp[]>();
      setAllApps(apps);
      setSelectedId((prev) => prev ?? apps[0]?.id ?? null);
    } catch (error) {
      console.error("[apps-panel] failed to refresh apps", error);
      setAllApps([]);
      setSearchResults([]);
      setSelectedId(null);
    }
  }, [backend.apps]);

  React.useEffect(() => {
    void refreshAllApps();
  }, [refreshAllApps]);

  React.useEffect(() => {
    let cancelled = false;

    const hydrateSettings = async () => {
      const catalog = await loadSettingsCatalog();
      if (!cancelled) {
        setSettingsCatalog(catalog);
      }
    };

    void hydrateSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    let unlisten: (() => void) | undefined;
    const setup = async () => {
      unlisten = await listen("searchie://apps-updated", () => {
        void refreshAllApps();
      });
    };

    void setup();
    return () => {
      unlisten?.();
    };
  }, [refreshAllApps]);

  React.useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const q = debouncedQuery.trim();

      if (!q) {
        startTransition(() => {
          setSearchResults(allApps.slice(0, 120));
          setSelectedId((prev) => prev ?? allApps[0]?.id ?? null);
        });
        return;
      }

      let results: InstalledApp[] = [];
      try {
        results = await backend.apps.searchInstalledApps<InstalledApp[]>(q, 160);
      } catch (error) {
        console.error("[apps-panel] search failed", error);
      }

      if (cancelled) return;
      startTransition(() => {
        setSearchResults(results);
        setSelectedId((prev) => {
          if (prev && results.some((app) => app.id === prev)) return prev;
          return results[0]?.id ?? null;
        });
      });
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [allApps, backend.apps, debouncedQuery]);

  React.useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      await ensureAppsIconCacheBucket(iconFingerprint);
      if (!cancelled) {
        setIconCacheVersion((current) => current + 1);
      }
    };

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [iconFingerprint]);

  React.useEffect(() => {
    if (allApps.length === 0) {
      return;
    }

    const missingIds = allApps
      .map((app) => app.id)
      .filter((appId) => !hasCachedAppIcon(appId) && !pendingIconIdsRef.current.has(appId));

    if (missingIds.length === 0) {
      return;
    }

    for (const appId of missingIds) {
      pendingIconIdsRef.current.add(appId);
    }

    let cancelled = false;

    const loadIcons = async () => {
      try {
        const response = await backend.apps.getAppIcons(missingIds);
        const responseMap =
          response && typeof response === "object" ? response : ({} as Record<string, string | null>);
        const normalized = Object.fromEntries(
          missingIds.map((appId) => {
            const base64 = responseMap[appId] ?? null;
            return [appId, base64 ? `data:image/png;base64,${base64}` : null];
          }),
        );
        await cacheAppIcons(iconFingerprint, normalized);
      } catch (error) {
        console.error("[apps-panel] batched icon load failed", error);
        const fallback = Object.fromEntries(missingIds.map((appId) => [appId, null]));
        await cacheAppIcons(iconFingerprint, fallback);
      } finally {
        for (const appId of missingIds) {
          pendingIconIdsRef.current.delete(appId);
        }
        if (!cancelled) {
          setIconCacheVersion((current) => current + 1);
        }
      }
    };

    void loadIcons();
    return () => {
      cancelled = true;
    };
  }, [allApps, backend.apps, iconFingerprint]);

  const injectedPanelSuggestions = React.useMemo<PanelCommandSuggestion[]>(() => {
    const queryForFilter = commandQuery.trim().toLowerCase();

    const suggestions: PanelCommandSuggestion[] = [];

    for (const panel of panelRegistry.list()) {
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
  }, [commandQuery, panelRegistry]);

  const settingsQuery = React.useMemo(
    () => extractSettingsAliasQuery(debouncedQuery, SETTINGS_SEARCH_ALIAS_LIST),
    [debouncedQuery],
  );

  const injectedSettingsResults = React.useMemo<SettingsSearchEntry[]>(() => {
    if (!settingsQuery.usedAlias && !settingsQuery.query) {
      return [];
    }

    const limit = settingsQuery.usedAlias ? 48 : 8;
    return searchSettingsEntries(settingsCatalog, settingsQuery.query, limit);
  }, [settingsCatalog, settingsQuery.query, settingsQuery.usedAlias]);

  const navigationList = React.useMemo<NavigationItem[]>(() => {
    const source = (debouncedQuery.trim() ? searchResults : allApps).slice(0, 72);
    const items: NavigationItem[] = source.map((app) => ({
      id: app.id,
      kind: "app",
      app,
    }));

    const settingsItems: NavigationItem[] = injectedSettingsResults.map((setting) => ({
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

    if (injectedPanelSuggestions.length > 0) {
      const injectedItems: NavigationItem[] = injectedPanelSuggestions.map((suggestion) => ({
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
  }, [allApps, debouncedQuery, injectedPanelSuggestions, injectedSettingsResults, searchResults]);

  const selectedItem = React.useMemo<NavigationItem | null>(() => {
    if (!selectedId) {
      return navigationList[0] ?? null;
    }
    return navigationList.find((item) => item.id === selectedId) ?? navigationList[0] ?? null;
  }, [navigationList, selectedId]);

  const selectedListIndex = React.useMemo(() => {
    if (!navigationList.length) {
      return -1;
    }

    if (!selectedItem) {
      return 0;
    }

    return navigationList.findIndex((item) => item.id === selectedItem.id);
  }, [navigationList, selectedItem]);

  const selectedApp = selectedItem?.kind === "app" ? selectedItem.app : null;
  const useVirtualizedList = navigationList.length > 36;

  const executeSettingOpen = React.useCallback(
    async (setting: SettingsSearchEntry, uri?: string) => {
      const targetUri = uri ?? setting.uris[0];
      if (!targetUri) {
        return;
      }

      clearLauncherInput?.();
      closeLauncherWindow?.();

      try {
        await backend.window.shellExecuteW(targetUri);
      } catch (error) {
        console.error("[apps-panel] settings launch failed", {
          settingsPage: setting.settingsPage,
          uri: targetUri,
          message: getErrorMessage(error),
          error,
        });
      }
    },
    [backend.window, clearLauncherInput, closeLauncherWindow],
  );

  const renderNavigationItem = (item: NavigationItem) => {
    const active = selectedItem?.id === item.id;

    if (item.kind === "panel-command") {
      const CommandIcon = item.command.panel.commandIcon ?? Rocket;
      return (
        <PanelListItem
          type="button"
          active={active}
          ref={(el) => {
            if (el) {
              itemRefs.current.set(item.id, el);
            } else {
              itemRefs.current.delete(item.id);
            }
          }}
          onMouseEnter={() => {
            setNavigationMode("list");
            setSelectedId(item.id);
          }}
          onFocus={() => {
            setNavigationMode("list");
            setSelectedId(item.id);
          }}
          onClick={() => {
            setNavigationMode("list");
            setSelectedId(item.id);
            clearLauncherInput?.();
            activatePanelSession?.(item.command.panel, item.command.commandQuery);
          }}
        >
          <PanelFlex align="center" justify="between" style={{ width: "100%" }}>
            <PanelFlex align="center" gap="sm">
              <PanelContainer
                surface="muted"
                radius="sm"
                style={{ width: 24, height: 24, display: "grid", placeItems: "center", flexShrink: 0 }}
              >
                <CommandIcon size={14} />
              </PanelContainer>
              <SingleLineTooltipText text={`Open ${item.command.label}`} size="sm" />
            </PanelFlex>
            <PanelInline size="xs" tone="muted" mono>Command</PanelInline>
          </PanelFlex>
        </PanelListItem>
      );
    }

    if (item.kind === "setting") {
      const setting = item.setting;
      return (
        <PanelListItem
          type="button"
          active={active}
          ref={(el) => {
            if (el) {
              itemRefs.current.set(item.id, el);
            } else {
              itemRefs.current.delete(item.id);
            }
          }}
          onMouseEnter={() => {
            setNavigationMode("list");
            setSelectedId(item.id);
          }}
          onFocus={() => {
            setNavigationMode("list");
            setSelectedId(item.id);
          }}
          onClick={() => {
            setNavigationMode("list");
            setSelectedId(item.id);
            void executeSettingOpen(setting);
          }}
        >
          <PanelFlex align="center" justify="between" style={{ width: "100%" }}>
            <PanelFlex align="center" gap="sm">
              <PanelContainer
                surface="muted"
                radius="sm"
                style={{ width: 24, height: 24, display: "grid", placeItems: "center", flexShrink: 0 }}
              >
                <Settings2 size={14} />
              </PanelContainer>
              <PanelFlex direction="col" gap="xs">
                <SingleLineTooltipText text={`Open Setting ${setting.settingsPage}`} size="sm" />
                <SingleLineTooltipText text={setting.uris[0] ?? "ms-settings:"} size="xs" tone="muted" />
              </PanelFlex>
            </PanelFlex>
            <PanelInline size="xs" tone="muted" mono>Setting</PanelInline>
          </PanelFlex>
        </PanelListItem>
      );
    }

    const app = item.app;
    return (
      <PanelListItem
        type="button"
        active={active}
        ref={(el) => {
          if (el) {
            itemRefs.current.set(item.id, el);
          } else {
            itemRefs.current.delete(item.id);
          }
        }}
        onMouseEnter={() => {
          setNavigationMode("list");
          setSelectedId(item.id);
        }}
        onFocus={() => {
          setNavigationMode("list");
          setSelectedId(item.id);
        }}
        onClick={() => {
          setNavigationMode("list");
          setSelectedId(item.id);
          void executeAppAction("open", app);
        }}
      >
        <AppIcon appId={app.id} cacheVersion={iconCacheVersion} />
        <SingleLineTooltipText text={app.name} size="sm" />
      </PanelListItem>
    );
  };

  const appActions = React.useMemo<AppActionItem[]>(() => {
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
  }, [selectedApp]);

  React.useEffect(() => {
    if (useVirtualizedList) {
      return;
    }

    if (!selectedId) return;
    const target = itemRefs.current.get(selectedId);
    if (target && typeof target.scrollIntoView === "function") {
      target.scrollIntoView({ block: "nearest" });
    }
  }, [selectedId, useVirtualizedList]);

  React.useEffect(() => {
    if (!appActions.length) {
      setSelectedActionIndex(0);
      setNavigationMode("list");
      return;
    }

    setSelectedActionIndex((current) => Math.min(current, appActions.length - 1));
  }, [appActions]);

  const executeAppAction = React.useCallback(
    async (actionId: AppActionItem["id"], app: InstalledApp) => {
      setBusy(true);
      setBusyActionId(actionId);

      try {
        if (actionId === "open") {
          clearLauncherInput?.();
          closeLauncherWindow?.();
          await backend.apps.launchInstalledApp(app.id);
          return;
        }

        if (actionId === "run-as-admin") {
          await backend.apps.launchInstalledAppAsAdmin(app.id);
          return;
        }

        if (actionId === "uninstall") {
          await backend.apps.uninstallInstalledApp(app.id);
          return;
        }

        if (actionId === "properties") {
          await backend.apps.openInstalledAppProperties(app.id);
          return;
        }

        await backend.apps.openInstalledAppInstallLocation(app.id);
      } catch (error) {
        console.error("[apps-panel] app action failed", {
          actionId,
          appId: app.id,
          message: getErrorMessage(error),
          error,
        });
      } finally {
        setBusy(false);
        setBusyActionId(null);
      }
    },
    [backend.apps, clearLauncherInput, closeLauncherWindow],
  );

  const focusListItemById = React.useCallback((id: string, preventScroll = false) => {
    const element = itemRefs.current.get(id);
    if (!element) {
      return;
    }

    if (preventScroll) {
      element.focus({ preventScroll: true });
      return;
    }

    element.focus();
  }, []);

  const focusActionByIndex = React.useCallback((index: number) => {
    actionRefs.current[index]?.focus();
  }, []);

  const selectFirstAppItem = React.useCallback(() => {
    const firstAppItem = navigationList.find((item) => item.kind === "app");
    if (!firstAppItem || firstAppItem.kind !== "app") {
      return false;
    }

    setNavigationMode("list");
    setSelectedId(firstAppItem.id);
    focusListItemById(firstAppItem.id, useVirtualizedList);
    return true;
  }, [focusListItemById, navigationList, useVirtualizedList]);

  const activateSelectedItem = React.useCallback(() => {
    if (!selectedItem) {
      return false;
    }

    if (selectedItem.kind === "panel-command") {
      clearLauncherInput?.();
      activatePanelSession?.(selectedItem.command.panel, selectedItem.command.commandQuery);
      return true;
    }

    if (selectedItem.kind === "setting") {
      void executeSettingOpen(selectedItem.setting);
      return true;
    }

    void executeAppAction("open", selectedItem.app);
    return true;
  }, [activatePanelSession, clearLauncherInput, executeAppAction, executeSettingOpen, selectedItem]);

  const footerConfig = React.useMemo<PanelFooterConfig | null>(() => {
    if (!selectedItem) {
      return null;
    }

    if (selectedItem.kind === "panel-command") {
      return {
        panel: {
          title: "Apps",
          icon: Rocket,
        },
        registerControls: registerFooterControls,
        primaryAction: {
          id: "open-panel-command",
          label: `Open ${selectedItem.command.panel.name}`,
          icon: Rocket,
          onSelect: () => {
            clearLauncherInput?.();
            activatePanelSession?.(selectedItem.command.panel, selectedItem.command.commandQuery);
          },
          shortcutHint: "Enter",
        },
      };
    }

    if (selectedItem.kind === "setting") {
      const currentSetting = selectedItem.setting;
      const extraActions = currentSetting.uris.slice(1).map((uri, index) => ({
        id: `open-setting-uri-${index + 2}`,
        label: `Open Alternative URI ${index + 2}`,
        icon: Settings2,
        onSelect: () => {
          void executeSettingOpen(currentSetting, uri);
        },
      }));

      return {
        panel: {
          title: "Apps",
          icon: Rocket,
        },
        registerControls: registerFooterControls,
        primaryAction: {
          id: "open-setting",
          label: `Open ${currentSetting.settingsPage}`,
          icon: Settings2,
          onSelect: () => {
            void executeSettingOpen(currentSetting);
          },
          shortcutHint: "Enter",
        },
        extraActions,
      };
    }

    const currentApp = selectedItem.app;
    const extraActions = appActions
      .filter((action) => action.id !== "open")
      .map((action) => ({
        id: action.id,
        label: action.label,
        icon:
          action.id === "run-as-admin"
            ? Shield
            : action.id === "uninstall"
              ? Trash2
              : action.id === "properties"
                ? Wrench
                : FolderOpen,
        shortcutHint:
          action.id === "run-as-admin"
            ? "Alt+R"
            : action.id === "uninstall"
              ? "Alt+U"
              : action.id === "properties"
                ? "Alt+P"
                : "Alt+L",
        onSelect: () => {
          if (!action.disabled) {
            void executeAppAction(action.id, currentApp);
          }
        },
        disabled: busy || action.disabled,
      }));

    return {
      panel: {
        title: "Apps",
        icon: Rocket,
      },
      registerControls: registerFooterControls,
      primaryAction: {
        id: "open-app",
        label: "Open App",
        icon: Rocket,
        onSelect: () => {
          void executeAppAction("open", currentApp);
        },
        disabled: busy,
        loading: busy && busyActionId === "open",
        shortcutHint: "Enter",
      },
      extraActions,
    };
  }, [
    activatePanelSession,
    appActions,
    busy,
    busyActionId,
    clearLauncherInput,
    executeAppAction,
    executeSettingOpen,
    registerFooterControls,
    selectedItem,
  ]);

  usePanelFooter(registerPanelFooter, footerConfig);

  const onInputArrowDown = React.useCallback(() => {
    if (!navigationList.length) {
      return false;
    }

    const first = navigationList[0];
    if (!first) {
      return false;
    }

    setSelectedId(first.id);
    setNavigationMode("list");
    const target = itemRefs.current.get(first.id);
    if (target) {
      if (useVirtualizedList) {
        target.focus({ preventScroll: true });
      } else {
        target.focus();
      }
      return true;
    }

    return false;
  }, [navigationList, useVirtualizedList]);

  usePanelArrowDownBridge(registerInputArrowDownHandler, onInputArrowDown);
  usePanelEnterBridge(registerInputEnterHandler, activateSelectedItem);

  useHotkey(
    "Alt+K",
    () => {
      footerControlsRef.current?.openExtraActions();
    },
    {
      enabled: !!selectedItem && (footerConfig?.extraActions?.length ?? 0) > 0,
      preventDefault: true,
    },
  );

  useHotkey(
    "Alt+R",
    () => {
      if (!selectedApp) {
        return;
      }
      footerControlsRef.current?.runExtraActionById("run-as-admin");
    },
    { enabled: !!selectedApp, preventDefault: true },
  );

  useHotkey(
    "Alt+U",
    () => {
      if (!selectedApp) {
        return;
      }
      footerControlsRef.current?.runExtraActionById("uninstall");
    },
    { enabled: !!selectedApp, preventDefault: true },
  );

  useHotkey(
    "Alt+P",
    () => {
      if (!selectedApp) {
        return;
      }
      footerControlsRef.current?.runExtraActionById("properties");
    },
    { enabled: !!selectedApp, preventDefault: true },
  );

  useHotkey(
    "Alt+L",
    () => {
      if (!selectedApp) {
        return;
      }
      footerControlsRef.current?.runExtraActionById("open-location");
    },
    { enabled: !!selectedApp, preventDefault: true },
  );

  useHotkey(
    "ArrowDown",
    () => {
      if (!navigationList.length) {
        return;
      }

      if (navigationMode === "actions" && selectedApp && appActions.length > 0) {
        setSelectedActionIndex((prev) => {
          const next = Math.min(appActions.length - 1, prev + 1);
          focusActionByIndex(next);
          return next;
        });
        return;
      }

      const currentIndex = selectedListIndex >= 0 ? selectedListIndex : 0;
      const nextIndex = Math.min(navigationList.length - 1, currentIndex + 1);
      const nextItem = navigationList[nextIndex];
      if (!nextItem) {
        return;
      }

      setNavigationMode("list");
      setSelectedId(nextItem.id);
      focusListItemById(nextItem.id, useVirtualizedList);
    },
    { enabled: navigationList.length > 0, preventDefault: true },
  );

  useHotkey(
    "ArrowUp",
    () => {
      if (!navigationList.length) {
        return;
      }

      if (navigationMode === "actions" && selectedApp && appActions.length > 0) {
        setSelectedActionIndex((prev) => {
          const next = prev - 1;
          if (next >= 0) {
            focusActionByIndex(next);
            return next;
          }

          setNavigationMode("list");
          setSelectedId(selectedApp.id);
          focusListItemById(selectedApp.id, useVirtualizedList);
          return 0;
        });
        return;
      }

      const currentIndex = selectedListIndex >= 0 ? selectedListIndex : 0;
      const prevIndex = currentIndex - 1;
      if (prevIndex < 0) {
        focusLauncherInput?.();
        return;
      }

      const prevItem = navigationList[prevIndex];
      if (!prevItem) {
        return;
      }

      setNavigationMode("list");
      setSelectedId(prevItem.id);
      focusListItemById(prevItem.id, useVirtualizedList);
    },
    { enabled: navigationList.length > 0, preventDefault: true },
  );

  useHotkey(
    "ArrowRight",
    () => {
      if (!selectedApp || appActions.length === 0) {
        return;
      }

      setNavigationMode("actions");
      const nextIndex = Math.min(selectedActionIndex, appActions.length - 1);
      setSelectedActionIndex(nextIndex);
      focusActionByIndex(nextIndex);
    },
    { enabled: !!selectedApp && appActions.length > 0, preventDefault: true },
  );

  useHotkey(
    "ArrowLeft",
    () => {
      if (selectedItem?.kind === "panel-command") {
        selectFirstAppItem();
        return;
      }

      if (selectedItem?.kind === "setting") {
        selectFirstAppItem();
        return;
      }

      if (navigationMode !== "actions" || !selectedApp) {
        return;
      }

      setNavigationMode("list");
      setSelectedId(selectedApp.id);
      focusListItemById(selectedApp.id, useVirtualizedList);
    },
    {
      enabled:
        (navigationMode === "actions" && !!selectedApp) ||
        selectedItem?.kind === "panel-command" ||
        selectedItem?.kind === "setting",
      preventDefault: true,
    },
  );

  useHotkey(
    "Escape",
    () => {
      const activeElement = document.activeElement;
      if (isEditableElement(activeElement)) {
        return;
      }

      focusLauncherInput?.();
    },
    { enabled: !!focusLauncherInput },
  );

  useHotkey(
    "Enter",
    () => {
      if (navigationMode === "actions" && selectedApp) {
        const action = appActions[selectedActionIndex];
        if (action && !action.disabled) {
          void executeAppAction(action.id, selectedApp);
        }
        return;
      }

      activateSelectedItem();
    },
    { enabled: !!selectedItem, preventDefault: true },
  );

  return (
    <PanelTooltipProvider>
      <PanelGrid columns="two-pane" gap="sm" style={{ height: "100%" }}>
        <PanelContainer ref={listScrollHostRef} style={{ overflow: "hidden", height: "100%" }}>
          <PanelScrollArea style={{ height: "100%" }}>
            <PanelList
              gap="xs"
              virtualize={
                useVirtualizedList
                  ? {
                      count: navigationList.length,
                      estimateSize: 42,
                      overscan: 10,
                      scrollToIndex: selectedListIndex >= 0 ? selectedListIndex : undefined,
                      getScrollElement: getListScrollViewport,
                      getItemKey: (index) => navigationList[index]?.id ?? `nav-item-${index}`,
                      renderItem: (index) => {
                        const item = navigationList[index];
                        if (!item) {
                          return null;
                        }
                        return renderNavigationItem(item);
                      },
                    }
                  : undefined
              }
            >
              {!useVirtualizedList
                ? navigationList.map((item) => (
                    <React.Fragment key={item.id}>{renderNavigationItem(item)}</React.Fragment>
                  ))
                : null}
            </PanelList>
          </PanelScrollArea>
        </PanelContainer>

        <PanelAside>
          {selectedItem?.kind === "panel-command" ? (
            <PanelFlex direction="col" justify="between" gap="sm" style={{ height: "100%" }}>
              <PanelContainer>
                <PanelParagraph size="sm" tone="muted">Press Enter to open {selectedItem.command.panel.name}.</PanelParagraph>
              </PanelContainer>
              <PanelButton
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  selectFirstAppItem();
                }}
              >
                <PanelInline>
                  <ArrowLeft size={14} />
                  Back to Apps
                </PanelInline>
                <PanelInline size="xs" tone="muted" mono>Left Arrow</PanelInline>
              </PanelButton>
            </PanelFlex>
          ) : selectedItem?.kind === "setting" ? (
            <PanelFlex direction="col" gap="md">
              <PanelContainer>
                <PanelParagraph size="xs" tone="muted">
                  Selected Setting
                </PanelParagraph>
                <SingleLineTooltipText text={selectedItem.setting.settingsPage} size="xl" />
                <SingleLineTooltipText text={selectedItem.setting.uris[0] ?? "ms-settings:"} size="xs" tone="muted" />
              </PanelContainer>

              <PanelFlex direction="col" gap="sm">
                <DetailRow label="URIs" value={String(selectedItem.setting.uris.length)} />
                <DetailRow label="Primary URI" value={selectedItem.setting.uris[0] ?? "-"} />
              </PanelFlex>

              <PanelFlex direction="col" gap="sm">
                <PanelFlex align="center" justify="between">
                  <PanelInline>Open setting</PanelInline>
                  <PanelInline mono>Enter</PanelInline>
                </PanelFlex>
                <PanelFlex align="center" justify="between">
                  <PanelInline>Back to app list</PanelInline>
                  <PanelInline mono>Left Arrow</PanelInline>
                </PanelFlex>
              </PanelFlex>
            </PanelFlex>
          ) : selectedApp ? (
            <PanelFlex direction="col" gap="md">
              <PanelContainer>
                <PanelParagraph size="xs" tone="muted">
                  Selected App
                </PanelParagraph>
                <SingleLineTooltipText text={selectedApp.name} size="xl" />
                <SingleLineTooltipText text={selectedApp.launchPath} size="xs" tone="muted" />
              </PanelContainer>

              <PanelFlex direction="col" gap="sm">
                <DetailRow label="Publisher" value={selectedApp.publisher ?? "Unknown"} />
                <DetailRow label="Version" value={selectedApp.version ?? "-"} />
                <DetailRow label="Source" value={selectedApp.source} />
                <DetailRow label="Install Path" value={selectedApp.installLocation ?? "-"} />
              </PanelFlex>

              <PanelFlex direction="col" gap="sm">
                <PanelFlex align="center" justify="between">
                  <PanelInline>List to Actions</PanelInline>
                  <PanelInline mono>Right Arrow</PanelInline>
                </PanelFlex>
                <PanelFlex align="center" justify="between">
                  <PanelInline>Actions to List</PanelInline>
                  <PanelInline mono>Left Arrow</PanelInline>
                </PanelFlex>
                <PanelFlex align="center" justify="between">
                  <PanelInline>Navigate / Run</PanelInline>
                  <PanelInline mono>Up Down + Enter</PanelInline>
                </PanelFlex>
              </PanelFlex>
            </PanelFlex>
          ) : (
            <PanelContainer style={{ height: "100%", display: "grid", placeItems: "center" }}>
              <PanelParagraph tone="muted">No apps found.</PanelParagraph>
            </PanelContainer>
          )}
        </PanelAside>
      </PanelGrid>
    </PanelTooltipProvider>
  );
}
