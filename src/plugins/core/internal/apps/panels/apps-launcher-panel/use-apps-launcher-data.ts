import * as React from "react";
import { listen } from "@tauri-apps/api/event";
import { useCommandRegistry } from "@/lib/command-registry";
import { createPluginBackendSdk } from "@/plugins/sdk";
import { cacheAppsList, loadCachedAppsList } from "@/lib/apps-list-cache";
import {
  cacheAppIcons,
  computeAppsIconFingerprint,
  ensureAppsIconCacheBucket,
  hasCachedAppIcon,
} from "@/lib/apps-icon-cache";
import { usePanelRegistry } from "@/lib/panel-registry";
import { getErrorMessage } from "./helpers";
import { useDebouncedValue } from "./hooks";
import { launcherCommandScope } from "./panel-scope";
import { mergeAppsList } from "./apps-list-diff";
import { buildAppActions, buildInjectedCommandSuggestions, buildInjectedPanelSuggestions, buildNavigationList } from "./selectors";
import type { AppActionItem, InstalledApp, NavigationItem, NavigationMode } from "./types";

type UseAppsLauncherDataArgs = {
  commandQuery: string;
  clearLauncherInput?: (() => void) | undefined;
  closeLauncherWindow?: (() => void) | undefined;
};

export function useAppsLauncherData({
  commandQuery,
  clearLauncherInput,
  closeLauncherWindow,
}: UseAppsLauncherDataArgs) {
  const backend = React.useMemo(() => createPluginBackendSdk(launcherCommandScope), []);
  const commandRegistry = useCommandRegistry();
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
  const [appsSnapshotHydrated, setAppsSnapshotHydrated] = React.useState(false);

  const itemRefs = React.useRef<Map<string, HTMLButtonElement>>(new Map());
  const actionRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const pendingIconIdsRef = React.useRef<Set<string>>(new Set());
  const listScrollHostRef = React.useRef<HTMLDivElement | null>(null);

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
      setAllApps((previous) => mergeAppsList(previous, apps));
      setSelectedId((previous) => {
        if (previous && apps.some((app) => app.id === previous)) {
          return previous;
        }

        return apps[0]?.id ?? null;
      });
      await cacheAppsList(apps);
    } catch (error) {
      console.error("[apps-panel] failed to refresh apps", error);
    } finally {
      setAppsSnapshotHydrated(true);
    }
  }, [backend.apps]);

  React.useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      const cachedApps = await loadCachedAppsList<InstalledApp>();
      if (!cancelled && cachedApps.length > 0) {
        setAllApps(cachedApps);
        setSelectedId((previous) => previous ?? cachedApps[0]?.id ?? null);
      }

      if (!cancelled) {
        setAppsSnapshotHydrated(true);
      }

      void refreshAllApps();
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [refreshAllApps]);



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
      if (!appsSnapshotHydrated) {
        startTransition(() => {
          setSearchResults([]);
        });
        return;
      }

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

      if (cancelled) {
        return;
      }

      startTransition(() => {
        setSearchResults(results);
        setSelectedId((prev) => {
          if (prev && results.some((app) => app.id === prev)) {
            return prev;
          }
          return results[0]?.id ?? null;
        });
      });
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [allApps, appsSnapshotHydrated, backend.apps, debouncedQuery]);

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
        const responseMap = response && typeof response === "object" ? response : ({} as Record<string, string | null>);
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

  const injectedPanelSuggestions = React.useMemo(
    () => buildInjectedPanelSuggestions(commandQuery, panelRegistry.list()),
    [commandQuery, panelRegistry],
  );

  const injectedCommandSuggestions = React.useMemo(
    () => buildInjectedCommandSuggestions(commandQuery, commandRegistry.list()),
    [commandQuery, commandRegistry],
  );



  const navigationList = React.useMemo(
    () =>
      buildNavigationList({
        allApps,
        searchResults,
        debouncedQuery,
        injectedPanelSuggestions,
        injectedCommandSuggestions,
      }),
    [allApps, debouncedQuery, injectedCommandSuggestions, injectedPanelSuggestions, searchResults],
  );

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
  const appActions = React.useMemo(() => buildAppActions(selectedApp), [selectedApp]);

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

  const executeDirectCommand = React.useCallback(
    async (command: NavigationItem & { kind: "direct-command" }) => {
      await command.command.command.execute({
        source: "apps",
        rawQuery: commandQuery,
        commandQuery: command.command.commandQuery,
        clearLauncherInput,
        closeLauncherWindow,
      });
    },
    [clearLauncherInput, closeLauncherWindow, commandQuery],
  );

  React.useEffect(() => {
    if (useVirtualizedList) {
      return;
    }

    if (!selectedId) {
      return;
    }

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

  return {
    itemRefs,
    actionRefs,
    listScrollHostRef,
    getListScrollViewport,
    selectedId,
    setSelectedId,
    selectedItem,
    selectedApp,
    selectedListIndex,
    selectedActionIndex,
    setSelectedActionIndex,
    navigationMode,
    setNavigationMode,
    navigationList,
    iconCacheVersion,
    useVirtualizedList,
    appActions,
    busy,
    busyActionId,
    executeAppAction,
    executeDirectCommand,
    focusListItemById,
    focusActionByIndex,
    selectFirstAppItem,
  };
}
