import * as React from "react";
import { ArrowLeft, FolderOpen, Rocket, Shield, Trash2, Wrench } from "lucide-react";
import { useHotkey } from "@tanstack/react-hotkeys";
import {
  Button as PanelButton,
  Grid as PanelGrid,
  List as PanelList,
  MetaGrid as PanelMetaGrid,
  PanelContainer,
  PanelFigureImage,
  PanelFlex,
  PanelParagraph,
  PanelSection,
  PanelText,
  PanelTextButton,
  ScrollArea as PanelScrollArea,
  Tooltip as PanelTooltip,
  TooltipContent as PanelTooltipContent,
  TooltipProvider as PanelTooltipProvider,
  TooltipTrigger as PanelTooltipTrigger,
  createPluginBackendSdk,
  usePanelArrowDownBridge,
  usePanelEnterBridge,
  usePanelFooter,
  usePanelFooterControlsRef,
} from "@/plugins/sdk";
import type { PanelFooterConfig, ShortcutPanelDescriptor } from "@/lib/panel-contract";
import { usePanelRegistry } from "@/lib/panel-registry";
import type { PanelCommandScope } from "@/lib/tauri-commands";
import { cn } from "@/lib/utils";

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
};

type NavigationItem =
  | {
      id: string;
      kind: "app";
      app: InstalledApp;
    }
  | {
      id: string;
      kind: "panel-command";
      command: PanelCommandSuggestion;
    };

type NavigationMode = "list" | "actions";

const iconCache = new Map<string, string | null>();

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

function AppIcon({ appId, className }: { appId: string; className?: string }) {
  const backend = React.useMemo(() => createPluginBackendSdk(launcherCommandScope), []);
  const [src, setSrc] = React.useState<string | null>(iconCache.get(appId) ?? null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    setFailed(false);

    const cached = iconCache.get(appId);
    if (cached !== undefined) {
      setSrc(cached);
      return;
    }

    let cancelled = false;
    const load = async () => {
      try {
        const base64 = await backend.apps.getAppIcon(appId);
        if (cancelled) return;
        const next = base64 ? `data:image/png;base64,${base64}` : null;
        iconCache.set(appId, next);
        setSrc(next);
      } catch {
        if (cancelled) return;
        iconCache.set(appId, null);
        setSrc(null);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [appId, backend.apps]);

  if (!src || failed) {
    return (
      <PanelContainer className={cn("rounded-sm bg-muted grid place-items-center", className)}>
        <Rocket className="size-3.5 text-muted-foreground" />
      </PanelContainer>
    );
  }

  return (
    <PanelFigureImage
      src={src}
      alt=""
      className={cn("rounded-sm object-contain", className)}
      onError={() => setFailed(true)}
      loading="lazy"
    />
  );
}

type SingleLineTooltipTextProps = {
  text: string;
  className?: string;
  tooltipClassName?: string;
};

function SingleLineTooltipText({
  text,
  className,
  tooltipClassName,
}: SingleLineTooltipTextProps) {
  return (
    <PanelTooltip>
      <PanelTooltipTrigger
        render={<PanelText className={cn("block min-w-0 truncate whitespace-nowrap", className)}>{text}</PanelText>}
      />
      <PanelTooltipContent className={cn("max-w-md break-all", tooltipClassName)}>
        {text}
      </PanelTooltipContent>
    </PanelTooltip>
  );
}

type DetailRowProps = {
  label: string;
  value: string;
};

function DetailRow({ label, value }: DetailRowProps) {
  return (
    <PanelMetaGrid className="min-w-0">
      <PanelText tone="muted" className="whitespace-nowrap">
        {label}
      </PanelText>
      <SingleLineTooltipText text={value} className="text-right" />
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
  const debouncedQuery = useDebouncedValue(commandQuery, 120);
  const [allApps, setAllApps] = React.useState<InstalledApp[]>([]);
  const [searchResults, setSearchResults] = React.useState<InstalledApp[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [busyActionId, setBusyActionId] = React.useState<AppActionItem["id"] | null>(null);
  const [selectedActionIndex, setSelectedActionIndex] = React.useState(0);
  const [navigationMode, setNavigationMode] = React.useState<NavigationMode>("list");

  const itemRefs = React.useRef<Map<string, HTMLButtonElement>>(new Map());
  const actionRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const { controlsRef: footerControlsRef, registerFooterControls } = usePanelFooterControlsRef();

  const refreshAllApps = React.useCallback(async () => {
    try {
      const apps = await backend.apps.listInstalledApps<InstalledApp[]>();
      setAllApps(apps);
      if (!commandQuery.trim()) {
        setSearchResults(apps.slice(0, 120));
      }
      setSelectedId((prev) => prev ?? apps[0]?.id ?? null);
    } catch (error) {
      console.error("[apps-panel] failed to refresh apps", error);
      setAllApps([]);
      setSearchResults([]);
      setSelectedId(null);
    }
  }, [backend.apps, commandQuery]);

  React.useEffect(() => {
    void refreshAllApps();
  }, [refreshAllApps]);

  React.useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const q = debouncedQuery.trim();

      if (!q) {
        setSearchResults(allApps.slice(0, 120));
        setSelectedId((prev) => prev ?? allApps[0]?.id ?? null);
        return;
      }

      let results: InstalledApp[] = [];
      try {
        results = await backend.apps.searchInstalledApps<InstalledApp[]>(q, 160);
      } catch (error) {
        console.error("[apps-panel] search failed", error);
      }

      if (cancelled) return;
      setSearchResults(results);
      setSelectedId((prev) => {
        if (prev && results.some((app) => app.id === prev)) return prev;
        return results[0]?.id ?? null;
      });
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [allApps, backend.apps, debouncedQuery]);

  const panelCommandSuggestion = React.useMemo<PanelCommandSuggestion | null>(() => {
    const trimmed = commandQuery.trim().toLowerCase();
    if (!trimmed) {
      return null;
    }

    for (const panel of panelRegistry.list()) {
      if (panel.isDefault) {
        continue;
      }

      const mode = panel.searchIntegration?.activationMode ?? "immediate";
      if (mode !== "result-item") {
        continue;
      }

      const match = panel.matcher(commandQuery);
      if (match.matches) {
        return {
          id: `panel-command:${panel.id}`,
          panel,
          commandQuery: match.commandQuery,
        };
      }

      const aliasMatch = panel.aliases.some((alias) => alias.toLowerCase().includes(trimmed));
      const nameMatch = panel.name.toLowerCase().includes(trimmed);
      if (aliasMatch || nameMatch) {
        return {
          id: `panel-command:${panel.id}`,
          panel,
          commandQuery,
        };
      }
    }

    return null;
  }, [commandQuery, panelRegistry]);

  const navigationList = React.useMemo<NavigationItem[]>(() => {
    const source = (debouncedQuery.trim() ? searchResults : allApps).slice(0, 72);
    const items: NavigationItem[] = source.map((app) => ({
      id: app.id,
      kind: "app",
      app,
    }));

    if (panelCommandSuggestion) {
      const commandItem: NavigationItem = {
        id: panelCommandSuggestion.id,
        kind: "panel-command",
        command: panelCommandSuggestion,
      };

      if (items.length > 0) {
        items.splice(1, 0, commandItem);
      } else {
        items.unshift(commandItem);
      }
    }

    return items;
  }, [allApps, debouncedQuery, panelCommandSuggestion, searchResults]);

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
    if (!selectedId) return;
    const target = itemRefs.current.get(selectedId);
    if (target && typeof target.scrollIntoView === "function") {
      target.scrollIntoView({ block: "nearest" });
    }
  }, [selectedId]);

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

  const focusListItemById = React.useCallback((id: string) => {
    itemRefs.current.get(id)?.focus();
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
    focusListItemById(firstAppItem.id);
    return true;
  }, [focusListItemById, navigationList]);

  const activateSelectedItem = React.useCallback(() => {
    if (!selectedItem) {
      return false;
    }

    if (selectedItem.kind === "panel-command") {
      clearLauncherInput?.();
      activatePanelSession?.(selectedItem.command.panel, selectedItem.command.commandQuery);
      return true;
    }

    void executeAppAction("open", selectedItem.app);
    return true;
  }, [activatePanelSession, clearLauncherInput, executeAppAction, selectedItem]);

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
  }, [activatePanelSession, appActions, busy, busyActionId, clearLauncherInput, executeAppAction, registerFooterControls, selectedItem]);

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
      target.focus();
      return true;
    }

    return false;
  }, [navigationList]);

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
      focusListItemById(nextItem.id);
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
          focusListItemById(selectedApp.id);
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
      focusListItemById(prevItem.id);
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

      if (navigationMode !== "actions" || !selectedApp) {
        return;
      }

      setNavigationMode("list");
      setSelectedId(selectedApp.id);
      focusListItemById(selectedApp.id);
    },
    {
      enabled:
        (navigationMode === "actions" && !!selectedApp) || selectedItem?.kind === "panel-command",
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
      <PanelGrid columns="two-pane" gap="md">
        <PanelSection className="overflow-hidden h-full">
          <PanelScrollArea className="h-full">
            <PanelList className="flex flex-col p-0.5" gap="xs">
              {navigationList.map((item) => {
                const active = selectedItem?.id === item.id;

                if (item.kind === "panel-command") {
                  const CommandIcon = item.command.panel.commandIcon ?? Rocket;
                  return (
                    <PanelTextButton
                      key={item.id}
                      ref={(el) => {
                        if (el) itemRefs.current.set(item.id, el);
                        else itemRefs.current.delete(item.id);
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
                      tone={active ? "active" : "ghost"}
                      className="flex items-center justify-between gap-3"
                    >
                      <PanelFlex align="center" gap="md" className="min-w-0">
                        <PanelContainer className="rounded-sm bg-muted grid place-items-center size-6 shrink-0">
                          <CommandIcon className="size-3.5 text-muted-foreground" />
                        </PanelContainer>
                        <SingleLineTooltipText
                          text={`Open ${item.command.panel.name}`}
                          className="text-sm"
                        />
                      </PanelFlex>
                      <PanelText size="xs" tone="muted" mono>
                        Command
                      </PanelText>
                    </PanelTextButton>
                  );
                }

                const app = item.app;
                return (
                  <PanelTextButton
                    key={item.id}
                    ref={(el) => {
                      if (el) itemRefs.current.set(item.id, el);
                      else itemRefs.current.delete(item.id);
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
                    tone={active ? "active" : "ghost"}
                    className="flex items-center gap-3"
                  >
                    <AppIcon appId={app.id} className="size-6 shrink-0" />
                    <SingleLineTooltipText text={app.name} className="text-sm" />
                  </PanelTextButton>
                );
              })}
            </PanelList>
          </PanelScrollArea>
        </PanelSection>

        <PanelSection className="flex flex-col gap-3.5 overflow-hidden">
          {selectedItem?.kind === "panel-command" ? (
            <PanelContainer className="h-full flex flex-col justify-between text-center px-2 py-1">
              <PanelContainer className="flex-1 grid place-items-center">
                <PanelParagraph tone="muted" size="sm">
                  Press Enter to open {selectedItem.command.panel.name}.
                </PanelParagraph>
              </PanelContainer>
              <PanelButton
                type="button"
                variant="outline"
                size="sm"
                className="w-full justify-between"
                onClick={() => {
                  selectFirstAppItem();
                }}
              >
                <PanelFlex align="center" gap="sm" className="inline-flex">
                  <ArrowLeft className="size-3.5" />
                  <PanelText>Back to Apps</PanelText>
                </PanelFlex>
                <PanelText size="xs" tone="muted" mono>
                  Left Arrow
                </PanelText>
              </PanelButton>
            </PanelContainer>
          ) : selectedApp ? (
            <>
              <PanelContainer className="space-y-2 min-w-0">
                <PanelText size="xs" tone="muted" className="uppercase tracking-wider">
                  Selected App
                </PanelText>
                <SingleLineTooltipText text={selectedApp.name} className="text-xl font-semibold leading-tight" />
                <SingleLineTooltipText text={selectedApp.launchPath} className="text-xs text-muted-foreground" />
              </PanelContainer>

              <PanelContainer className="space-y-2 text-sm min-w-0">
                <DetailRow label="Publisher" value={selectedApp.publisher ?? "Unknown"} />
                <DetailRow label="Version" value={selectedApp.version ?? "-"} />
                <DetailRow label="Source" value={selectedApp.source} />
                <DetailRow label="Install Path" value={selectedApp.installLocation ?? "-"} />
              </PanelContainer>

              <PanelContainer className="mt-auto space-y-2 min-w-0">
                <PanelFlex justify="between" align="center">
                  <PanelText size="xs" tone="muted">
                    List to Actions
                  </PanelText>
                  <PanelText size="xs" tone="muted" mono>
                    Right Arrow
                  </PanelText>
                </PanelFlex>
                <PanelFlex justify="between" align="center">
                  <PanelText size="xs" tone="muted">
                    Actions to List
                  </PanelText>
                  <PanelText size="xs" tone="muted" mono>
                    Left Arrow
                  </PanelText>
                </PanelFlex>
                <PanelFlex justify="between" align="center">
                  <PanelText size="xs" tone="muted">
                    Navigate / Run
                  </PanelText>
                  <PanelText size="xs" tone="muted" mono>
                    Up Down + Enter
                  </PanelText>
                </PanelFlex>
              </PanelContainer>
            </>
          ) : (
            <PanelContainer className="h-full grid place-items-center">
              <PanelParagraph tone="muted" size="sm">
                No apps found.
              </PanelParagraph>
            </PanelContainer>
          )}
        </PanelSection>
      </PanelGrid>
    </PanelTooltipProvider>
  );
}
