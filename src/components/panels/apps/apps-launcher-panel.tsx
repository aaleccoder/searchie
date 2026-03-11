import * as React from "react";
import { FolderOpen, Rocket, Shield, Trash2, Wrench } from "lucide-react";
import { useHotkey } from "@tanstack/react-hotkeys";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  PanelFooterConfig,
  PanelFooterControls,
  ShortcutPanelDescriptor,
} from "@/lib/panel-contract";
import { usePanelRegistry } from "@/lib/panel-registry";
import { invokePanelCommand, type PanelCommandScope } from "@/lib/tauri-commands";
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
        const base64 = await invokePanelCommand<string | null>(
          launcherCommandScope,
          "get_app_icon",
          { appId },
        );
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
  }, [appId]);

  if (!src || failed) {
    return (
      <div className={cn("rounded-sm bg-muted grid place-items-center", className)}>
        <Rocket className="size-3.5 text-muted-foreground" />
      </div>
    );
  }

  return (
    <img
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
    <Tooltip>
      <TooltipTrigger
        render={
          <span className={cn("block min-w-0 truncate whitespace-nowrap", className)}>
            {text}
          </span>
        }
      />
      <TooltipContent className={cn("max-w-md break-all", tooltipClassName)}>{text}</TooltipContent>
    </Tooltip>
  );
}

type DetailRowProps = {
  label: string;
  value: string;
};

function DetailRow({ label, value }: DetailRowProps) {
  return (
    <div className="grid grid-cols-[auto_1fr] items-center gap-4">
      <span className="text-muted-foreground whitespace-nowrap">{label}</span>
      <SingleLineTooltipText text={value} className="text-right" />
    </div>
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
  const footerControlsRef = React.useRef<PanelFooterControls | null>(null);

  const registerFooterControls = React.useCallback((controls: PanelFooterControls | null) => {
    footerControlsRef.current = controls;
  }, []);

  const refreshAllApps = React.useCallback(async () => {
    try {
      const apps = await invokePanelCommand<InstalledApp[]>(
        launcherCommandScope,
        "list_installed_apps",
        {},
      );
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
  }, [commandQuery]);

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
        results = await invokePanelCommand<InstalledApp[]>(
          launcherCommandScope,
          "search_installed_apps",
          {
            query: q,
            limit: 160,
          },
        );
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
  }, [allApps, debouncedQuery]);

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
          await invokePanelCommand<void>(launcherCommandScope, "launch_installed_app", {
            appId: app.id,
          });
          return;
        }

        if (actionId === "run-as-admin") {
          await invokePanelCommand<void>(launcherCommandScope, "launch_installed_app_as_admin", {
            appId: app.id,
          });
          return;
        }

        if (actionId === "uninstall") {
          await invokePanelCommand<void>(launcherCommandScope, "uninstall_installed_app", {
            appId: app.id,
          });
          return;
        }

        if (actionId === "properties") {
          await invokePanelCommand<void>(launcherCommandScope, "open_installed_app_properties", {
            appId: app.id,
          });
          return;
        }

        await invokePanelCommand<void>(launcherCommandScope, "open_installed_app_install_location", {
          appId: app.id,
        });
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
    [clearLauncherInput, closeLauncherWindow],
  );

  const focusListItemById = React.useCallback((id: string) => {
    itemRefs.current.get(id)?.focus();
  }, []);

  const focusActionByIndex = React.useCallback((index: number) => {
    actionRefs.current[index]?.focus();
  }, []);

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

  React.useEffect(() => {
    registerPanelFooter?.(footerConfig);
    return () => {
      registerPanelFooter?.(null);
    };
  }, [footerConfig, registerPanelFooter]);

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

  React.useEffect(() => {
    registerInputArrowDownHandler?.(onInputArrowDown);
    return () => {
      registerInputArrowDownHandler?.(null);
    };
  }, [onInputArrowDown, registerInputArrowDownHandler]);

  React.useEffect(() => {
    registerInputEnterHandler?.(activateSelectedItem);
    return () => {
      registerInputEnterHandler?.(null);
    };
  }, [activateSelectedItem, registerInputEnterHandler]);

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
      if (navigationMode !== "actions" || !selectedApp) {
        return;
      }

      setNavigationMode("list");
      setSelectedId(selectedApp.id);
      focusListItemById(selectedApp.id);
    },
    { enabled: navigationMode === "actions" && !!selectedApp, preventDefault: true },
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
    <TooltipProvider>
      <div className="grid h-full grid-cols-[1.45fr_1fr] gap-2.5 items-stretch">
        <div className="overflow-hidden h-full">
          <ScrollArea className="h-full">
            <div className="">
              <div className="flex flex-col gap-1">
                {navigationList.map((item) => {
                  const active = selectedItem?.id === item.id;

                  if (item.kind === "panel-command") {
                    const CommandIcon = item.command.panel.commandIcon ?? Rocket;
                    return (
                      <button
                        key={item.id}
                        type="button"
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
                        className={cn(
                          "flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition cursor-pointer w-full outline-none focus-visible:outline-none focus-visible:ring-0",
                          active
                            ? "border-primary/70 bg-primary/10"
                            : "border-transparent hover:border-primary/40 hover:bg-accent/50",
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="rounded-sm bg-muted grid place-items-center size-6 shrink-0">
                            <CommandIcon className="size-3.5 text-muted-foreground" />
                          </div>
                          <SingleLineTooltipText
                            text={`Open ${item.command.panel.name}`}
                            className="text-sm"
                          />
                        </div>
                        <span className="text-[11px] text-muted-foreground font-mono">Command</span>
                      </button>
                    );
                  }

                  const app = item.app;
                  return (
                    <button
                      key={item.id}
                      type="button"
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
                      className={cn(
                        "flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition cursor-pointer w-full outline-none focus-visible:outline-none focus-visible:ring-0",
                        active
                          ? "border-primary/70 bg-primary/10"
                          : "border-transparent hover:border-primary/40 hover:bg-accent/50",
                      )}
                    >
                      <AppIcon appId={app.id} className="size-6 shrink-0" />
                      <SingleLineTooltipText text={app.name} className="text-sm" />
                    </button>
                  );
                })}
              </div>
            </div>
          </ScrollArea>
        </div>

        <aside className="flex flex-col gap-3.5 overflow-hidden">
          {selectedItem?.kind === "panel-command" ? (
            <div className="h-full grid place-items-center text-muted-foreground text-sm text-center px-2">
              Press Enter to open {selectedItem.command.panel.name}.
            </div>
          ) : selectedApp ? (
            <>
              <div className="space-y-2 min-w-0">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Selected App</p>
                <SingleLineTooltipText
                  text={selectedApp.name}
                  className="text-xl font-semibold leading-tight"
                />
                <SingleLineTooltipText
                  text={selectedApp.launchPath}
                  className="text-xs text-muted-foreground"
                />
              </div>

              <div className="space-y-2 text-sm min-w-0">
                <DetailRow label="Publisher" value={selectedApp.publisher ?? "Unknown"} />
                <DetailRow label="Version" value={selectedApp.version ?? "-"} />
                <DetailRow label="Source" value={selectedApp.source} />
                <DetailRow label="Install Path" value={selectedApp.installLocation ?? "-"} />
              </div>

              <div className="mt-auto space-y-2 min-w-0">
                
                <div className="text-xs text-muted-foreground flex items-center justify-between">
                  <span>List to Actions</span>
                  <span className="font-mono">Right Arrow</span>
                </div>
                <div className="text-xs text-muted-foreground flex items-center justify-between">
                  <span>Actions to List</span>
                  <span className="font-mono">Left Arrow</span>
                </div>
                <div className="text-xs text-muted-foreground flex items-center justify-between">
                  <span>Navigate / Run</span>
                  <span className="font-mono">Up Down + Enter</span>
                </div>
              </div>
            </>
          ) : (
            <div className="h-full grid place-items-center text-muted-foreground text-sm">
              No apps found.
            </div>
          )}
        </aside>
      </div>
    </TooltipProvider>
  );
}
