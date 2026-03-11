import * as React from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Rocket } from "lucide-react";
import { LauncherSearchInput } from "@/components/launcher-search-input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ShortcutPanelDescriptor } from "@/lib/panel-contract";
import { usePanelRegistry } from "@/lib/panel-registry";
import { invokePanelCommand, type PanelCommandScope } from "@/lib/tauri-commands";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";

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

type AppActionItem = {
  id: "open" | "run-as-admin" | "uninstall" | "properties" | "open-location";
  label: string;
  hint: string;
  disabled?: boolean;
};

type LauncherFocusArea = "list" | "actions";

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

type LauncherPanelProps = {
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onOpenSettings: () => void;
};

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

export function LauncherPanel({ expanded, onExpandedChange, onOpenSettings }: LauncherPanelProps) {
  const panelRegistry = usePanelRegistry();
  const [query, setQuery] = React.useState("");
  const debouncedQuery = useDebouncedValue(query, 120);
  const [allApps, setAllApps] = React.useState<InstalledApp[]>([]);
  const [searchResults, setSearchResults] = React.useState<InstalledApp[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [busyActionId, setBusyActionId] = React.useState<AppActionItem["id"] | null>(null);
  const [focusArea, setFocusArea] = React.useState<LauncherFocusArea>("list");
  const [selectedActionIndex, setSelectedActionIndex] = React.useState(0);
  const [activePanelSession, setActivePanelSession] = React.useState<{
    panel: ShortcutPanelDescriptor;
  } | null>(null);
  const immediatePanelResolution = React.useMemo(() => {
    if (activePanelSession) {
      return null;
    }

    const resolution = panelRegistry.find(query);
    if (!resolution) {
      return null;
    }

    const mode = resolution.panel.searchIntegration?.activationMode ?? "immediate";
    if (mode !== "immediate") {
      return null;
    }

    return resolution;
  }, [activePanelSession, panelRegistry, query]);

  const activePanel = activePanelSession?.panel ?? immediatePanelResolution?.panel ?? null;
  const activePanelQuery = activePanelSession ? query : immediatePanelResolution?.match.commandQuery ?? "";
  const searchPlaceholder = activePanel?.searchIntegration?.placeholder ?? "Search apps...";

  const inputRef = React.useRef<HTMLInputElement>(null);
  const itemRefs = React.useRef<Map<string, HTMLButtonElement>>(new Map());
  const activePanelArrowDownHandlerRef = React.useRef<(() => boolean | void) | null>(null);

  const registerInputArrowDownHandler = React.useCallback((handler: (() => boolean | void) | null) => {
    activePanelArrowDownHandlerRef.current = handler;
  }, []);

  const focusLauncherInput = React.useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const activatePanelSession = React.useCallback(
    (panel: ShortcutPanelDescriptor, nextQuery: string) => {
      setActivePanelSession({ panel });
      setQuery(nextQuery);
      if (!expanded) {
        onExpandedChange(true);
      }
    },
    [expanded, onExpandedChange],
  );

  const handleInputValueChange = React.useCallback(
    (next: string) => {
      setQuery(next);
      setFocusArea("list");
      const shouldExpand = next.trim().length > 0;
      if (shouldExpand !== expanded) {
        onExpandedChange(shouldExpand);
      }
    },
    [activePanel, expanded, onExpandedChange],
  );

  React.useEffect(() => {
    if (!activePanel) {
      activePanelArrowDownHandlerRef.current = null;
    }
  }, [activePanel]);

  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  React.useEffect(() => {
    const onWindowFocus = () => {
      inputRef.current?.focus();
    };
    window.addEventListener('focus', onWindowFocus);
    return () => window.removeEventListener('focus', onWindowFocus);
  }, []);

  const refreshAllApps = React.useCallback(async () => {
    try {
      const apps = await invokePanelCommand<InstalledApp[]>(
        launcherCommandScope,
        "list_installed_apps",
        {},
      );
      setAllApps(apps);
      if (!query.trim()) {
        setSearchResults(apps.slice(0, 120));
      }
      setSelectedId((prev) => prev ?? apps[0]?.id ?? null);
    } catch (error) {
      console.error("[launcher] failed to refresh apps", error);
      setAllApps([]);
      setSearchResults([]);
      setSelectedId(null);
    }
  }, [query]);

  React.useEffect(() => {
    void refreshAllApps();

    let unlisten: undefined | (() => void);
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
      if (activePanel) {
        setSearchResults([]);
        setSelectedId(null);
        return;
      }

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
        console.error("[launcher] search failed", error);
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
  }, [activePanel, debouncedQuery, allApps]);

  const panelCommandSuggestion = React.useMemo<PanelCommandSuggestion | null>(() => {
    if (activePanel) {
      return null;
    }

    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      return null;
    }

    for (const panel of panelRegistry.list()) {
      const mode = panel.searchIntegration?.activationMode ?? "immediate";
      if (mode !== "result-item") {
        continue;
      }

      const match = panel.matcher(query);
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
          commandQuery: query,
        };
      }
    }

    return null;
  }, [activePanel, panelRegistry, query]);

  const navigationList = React.useMemo<NavigationItem[]>(() => {
    if (activePanel) {
      return [];
    }
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
  }, [activePanel, allApps, debouncedQuery, panelCommandSuggestion, searchResults]);

  const selectedItem = React.useMemo(() => {
    if (!selectedId) return navigationList[0] ?? null;
    return navigationList.find((item) => item.id === selectedId) ?? navigationList[0] ?? null;
  }, [navigationList, selectedId]);

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
    if (!selectedApp) return;
    if (!selectedId) {
      setSelectedId(selectedApp.id);
    }
  }, [selectedApp, selectedId]);

  React.useEffect(() => {
    if (!selectedApp) {
      setFocusArea("list");
      setSelectedActionIndex(0);
      return;
    }

    setSelectedActionIndex((current) => {
      if (!appActions.length) {
        return 0;
      }
      return Math.min(current, appActions.length - 1);
    });
  }, [appActions, selectedApp]);

  React.useEffect(() => {
    if (!selectedId) return;
    const target = itemRefs.current.get(selectedId);
    if (target && typeof target.scrollIntoView === "function") {
      target.scrollIntoView({ block: "nearest" });
    }
  }, [selectedId]);

  const activateSelectedItem = React.useCallback(async () => {
    if (!selectedItem) return;

    if (selectedItem.kind === "panel-command") {
      activatePanelSession(selectedItem.command.panel, selectedItem.command.commandQuery);
      return;
    }

    try {
      setBusy(true);
      await invokePanelCommand<void>(launcherCommandScope, "launch_installed_app", {
        appId: selectedItem.app.id,
      });
    } catch (error) {
      console.error("[launcher] launch failed", error);
    } finally {
      setBusy(false);
    }
  }, [activatePanelSession, selectedItem]);

  const executeAppAction = React.useCallback(
    async (actionId: AppActionItem["id"], app: InstalledApp) => {
      setBusy(true);
      setBusyActionId(actionId);

      try {
        if (actionId === "open") {
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

        if (actionId === "open-location") {
          await invokePanelCommand<void>(
            launcherCommandScope,
            "open_installed_app_install_location",
            { appId: app.id },
          );
        }
      } catch (error) {
        console.error("[launcher] app action failed", {
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
    [],
  );

  const activateSelectedAction = React.useCallback(async () => {
    if (!selectedApp || !appActions.length) {
      return;
    }

    const action = appActions[selectedActionIndex] ?? appActions[0];
    if (!action || action.disabled) {
      return;
    }

    await executeAppAction(action.id, selectedApp);
  }, [appActions, executeAppAction, selectedActionIndex, selectedApp]);

  const launchById = React.useCallback(
    async (appId: string) => {
      try {
        setBusy(true);
        await invokePanelCommand<void>(launcherCommandScope, "launch_installed_app", { appId });
      } catch (error) {
        console.error("[launcher] launch by id failed", error);
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const moveActionSelection = React.useCallback(
    (delta: number) => {
      if (!appActions.length) {
        return;
      }
      const next = Math.max(0, Math.min(appActions.length - 1, selectedActionIndex + delta));
      setSelectedActionIndex(next);
    },
    [appActions.length, selectedActionIndex],
  );

  const moveSelection = React.useCallback(
    (delta: number) => {
      if (!navigationList.length) return;
      const index = Math.max(0, navigationList.findIndex((item) => item.id === (selectedId ?? "")));
      const next = Math.max(0, Math.min(navigationList.length - 1, index + delta));
      setSelectedId(navigationList[next]?.id ?? null);
    },
    [navigationList, selectedId],
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (activePanel?.onInputKeyDown) {
      const consumed = activePanel.onInputKeyDown(event, {
        rawQuery: query,
        commandQuery: activePanelQuery,
      });
      if (consumed) {
        event.preventDefault();
        return;
      }
    }

    if (event.key === "ArrowDown") {
      if (activePanel) {
        const consumed = activePanelArrowDownHandlerRef.current?.();
        if (consumed !== false) {
          event.preventDefault();
          return;
        }
      }
      event.preventDefault();
      if (focusArea === "actions") {
        moveActionSelection(1);
      } else {
        moveSelection(1);
      }
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (focusArea === "actions") {
        moveActionSelection(-1);
      } else {
        moveSelection(-1);
      }
      return;
    }
    if (event.key === "ArrowRight") {
      if (!activePanel && selectedApp && appActions.length) {
        event.preventDefault();
        setFocusArea("actions");
      }
      return;
    }
    if (event.key === "ArrowLeft") {
      if (!activePanel && focusArea === "actions") {
        event.preventDefault();
        setFocusArea("list");
      }
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (activePanel) {
        return;
      }

      if (focusArea === "actions") {
        void activateSelectedAction();
      } else {
        void activateSelectedItem();
      }
      return;
    }
    if (event.key === "Escape") {
      if (activePanel) {
        const shouldExitPanel = activePanel.searchIntegration?.exitOnEscape ?? true;
        if (shouldExitPanel) {
          event.preventDefault();
          setActivePanelSession(null);
          setQuery("");
          focusLauncherInput();
        }
        return;
      }

      if (query) {
        setQuery("");
        setFocusArea("list");
      } else {
        onExpandedChange(false);
        void getCurrentWindow().hide();
      }
    }
  };

  return (
    <div className="relative h-screen w-200 max-w-200 text-foreground overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.1),transparent_52%),radial-gradient(circle_at_bottom_right,hsl(var(--ring)/0.12),transparent_55%)]" />

      <LauncherSearchInput
        value={query}
        placeholder={searchPlaceholder}
        inputRef={inputRef}
        onValueChange={handleInputValueChange}
        onKeyDown={handleKeyDown}
        onOpenSettings={onOpenSettings}
      />

      {expanded && (
        <div className="relative h-[calc(100%-2.5rem)] p-2.5">
          {activePanel ? (
            <activePanel.component
              commandQuery={activePanelQuery}
              rawQuery={query}
              registerInputArrowDownHandler={registerInputArrowDownHandler}
              focusLauncherInput={focusLauncherInput}
            />
          ) : (
            <div className="grid h-full grid-cols-[1.45fr_1fr] gap-2.5 items-stretch">
              <div className="overflow-hidden h-full">
                <ScrollArea className="h-full">
                  <div className="p-3.5">
                    <div className="flex flex-col gap-1">
                      {navigationList.map((item) => {
                        const active = selectedItem?.id === item.id;

                        if (item.kind === "panel-command") {
                          const CommandIcon = item.command.panel.commandIcon ?? Rocket;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              ref={(el) => { if (el) itemRefs.current.set(item.id, el); else itemRefs.current.delete(item.id); }}
                              onMouseEnter={() => {
                                setFocusArea("list");
                                setSelectedId(item.id);
                              }}
                              onClick={() => {
                                setFocusArea("list");
                                setSelectedId(item.id);
                                activatePanelSession(item.command.panel, item.command.commandQuery);
                              }}
                              className={cn(
                                "flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition cursor-pointer w-full",
                                active
                                  ? "border-primary/70 bg-primary/10"
                                  : "border-transparent hover:border-primary/40 hover:bg-accent/50",
                              )}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="rounded-sm bg-muted grid place-items-center size-6 shrink-0">
                                  <CommandIcon className="size-3.5 text-muted-foreground" />
                                </div>
                                <span className="text-sm line-clamp-1">Open {item.command.panel.name}</span>
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
                            ref={(el) => { if (el) itemRefs.current.set(item.id, el); else itemRefs.current.delete(item.id); }}
                            onMouseEnter={() => {
                              setFocusArea("list");
                              setSelectedId(item.id);
                            }}
                            onClick={() => {
                              setFocusArea("list");
                              setSelectedId(app.id);
                              void launchById(app.id);
                            }}
                            className={cn(
                              "flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition cursor-pointer w-full",
                              active
                                ? "border-primary/70 bg-primary/10"
                                : "border-transparent hover:border-primary/40 hover:bg-accent/50",
                            )}
                          >
                            <AppIcon appId={app.id} className="size-6 shrink-0" />
                            <span className="text-sm line-clamp-1">{app.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </ScrollArea>
              </div>

              <aside className="rounded-xl border border-border/70 bg-card/92 shadow-lg p-3.5 flex flex-col gap-3.5">
                {selectedApp ? (
                  <>
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">Selected App</p>
                      <h3 className="text-xl font-semibold leading-tight">{selectedApp.name}</h3>
                      <p className="text-xs text-muted-foreground break-all">{selectedApp.launchPath}</p>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Publisher</span>
                        <span className="text-right">{selectedApp.publisher ?? "Unknown"}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Version</span>
                        <span className="text-right">{selectedApp.version ?? "-"}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Source</span>
                        <span className="text-right">{selectedApp.source}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Install Path</span>
                        <span className="text-right break-all">{selectedApp.installLocation ?? "-"}</span>
                      </div>
                    </div>

                    <div className="mt-auto space-y-2">
                      {appActions.map((action, index) => {
                        const active = focusArea === "actions" && selectedActionIndex === index;
                        const pending = busy && busyActionId === action.id;
                        return (
                          <Button
                            key={action.id}
                            variant={active ? "default" : "outline"}
                            className="w-full justify-between"
                            onMouseEnter={() => {
                              setFocusArea("actions");
                              setSelectedActionIndex(index);
                            }}
                            onClick={() => {
                              setFocusArea("actions");
                              setSelectedActionIndex(index);
                              if (!action.disabled) {
                                void executeAppAction(action.id, selectedApp);
                              }
                            }}
                            disabled={busy || action.disabled}
                          >
                            <span>{pending ? "Running..." : action.label}</span>
                            <span className="text-[11px] text-muted-foreground">{action.hint}</span>
                          </Button>
                        );
                      })}
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
          )}
        </div>
      )}
    </div>
  );
}
