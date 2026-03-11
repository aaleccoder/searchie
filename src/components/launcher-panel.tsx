import * as React from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Rocket, Search, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePanelRegistry } from "@/lib/panel-registry";
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
  source: string;
};

type LauncherPanelProps = {
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onOpenSettings: () => void;
};

const iconCache = new Map<string, string | null>();

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
        const base64 = await invoke<string | null>("get_app_icon", { appId });
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
  const activePanelResolution = React.useMemo(() => panelRegistry.find(query), [panelRegistry, query]);
  const activePanel = activePanelResolution?.panel ?? null;
  const activePanelQuery = activePanelResolution?.match.commandQuery ?? "";

  const inputRef = React.useRef<HTMLInputElement>(null);
  const itemRefs = React.useRef<Map<string, HTMLButtonElement>>(new Map());

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
    const apps = await invoke<InstalledApp[]>("list_installed_apps");
    setAllApps(apps);
    if (!query.trim()) {
      setSearchResults(apps.slice(0, 120));
    }
    setSelectedId((prev) => prev ?? apps[0]?.id ?? null);
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
      const q = debouncedQuery.trim();
      const panelMode = panelRegistry.find(q) !== null;

      if (panelMode) {
        setSearchResults([]);
        setSelectedId(null);
        return;
      }

      if (!q) {
        setSearchResults(allApps.slice(0, 120));
        setSelectedId((prev) => prev ?? allApps[0]?.id ?? null);
        return;
      }

      const results = await invoke<InstalledApp[]>("search_installed_apps", {
        query: q,
        limit: 160,
      });

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
  }, [debouncedQuery, allApps, panelRegistry]);

  const navigationList = React.useMemo(() => {
    if (activePanel) {
      return [];
    }
    const source = debouncedQuery.trim() ? searchResults : allApps;
    return source.slice(0, 72);
  }, [activePanel, debouncedQuery, searchResults, allApps]);

  const selectedApp = React.useMemo(() => {
    if (!selectedId) return navigationList[0] ?? null;
    return navigationList.find((app) => app.id === selectedId) ?? navigationList[0] ?? null;
  }, [navigationList, selectedId]);

  React.useEffect(() => {
    if (!selectedApp) return;
    if (!selectedId) {
      setSelectedId(selectedApp.id);
    }
  }, [selectedApp, selectedId]);

  React.useEffect(() => {
    if (!selectedId) return;
    itemRefs.current.get(selectedId)?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  const launchSelected = React.useCallback(async () => {
    if (!selectedApp) return;
    try {
      setBusy(true);
      await invoke("launch_installed_app", { appId: selectedApp.id });
    } finally {
      setBusy(false);
    }
  }, [selectedApp]);

  const launchById = React.useCallback(
    async (appId: string) => {
      try {
        setBusy(true);
        await invoke("launch_installed_app", { appId });
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const moveSelection = React.useCallback(
    (delta: number) => {
      if (!navigationList.length) return;
      const index = Math.max(
        0,
        navigationList.findIndex((app) => app.id === (selectedId ?? "")),
      );
      const next = Math.max(0, Math.min(navigationList.length - 1, index + delta));
      setSelectedId(navigationList[next]?.id ?? null);
    },
    [navigationList, selectedId],
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveSelection(1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveSelection(-1);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (activePanel) {
        return;
      }
      void launchSelected();
      return;
    } 
    if (event.key === "Escape") {
      if (query) {
        setQuery("");
      } else {
        onExpandedChange(false);
        void getCurrentWindow().hide();
      }
    }
  };

  return (
    <div className="relative h-screen w-200 max-w-200 text-foreground overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.1),transparent_52%),radial-gradient(circle_at_bottom_right,hsl(var(--ring)/0.12),transparent_55%)]" />

      <div className="relative h-10 w-full backdrop-blur-md" data-tauri-drag-region>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            const next = e.target.value;
            setQuery(next);
            const shouldExpand = next.trim().length > 0;
            if (shouldExpand !== expanded) onExpandedChange(shouldExpand);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search apps..."
          className="h-full rounded-none border-0 bg-transparent pl-10 pr-11 shadow-none focus-visible:ring-0"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
        />
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-0 top-0 h-10 w-10 rounded-none text-muted-foreground hover:text-foreground"
          onClick={onOpenSettings}
          aria-label="Open settings"
        >
          <Settings2 className="size-4" />
        </Button>
      </div>

      {expanded && (
        <div className="relative h-[calc(100%-2.5rem)] p-2.5">
          {activePanel ? (
            <activePanel.component commandQuery={activePanelQuery} rawQuery={query} />
          ) : (
            <div className="grid h-full grid-cols-[1.45fr_1fr] gap-2.5 items-stretch">
              <div className="overflow-hidden h-full">
                <ScrollArea className="h-full">
                  <div className="p-3.5">
                    <div className="flex flex-col gap-1">
                      {navigationList.map((app) => {
                        const active = selectedApp?.id === app.id;
                        return (
                          <button
                            key={app.id}
                            type="button"
                            ref={(el) => { if (el) itemRefs.current.set(app.id, el); else itemRefs.current.delete(app.id); }}
                            onMouseEnter={() => setSelectedId(app.id)}
                            onClick={() => {
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
                    </div>

                    <div className="mt-auto space-y-2">
                      <Button className="w-full" onClick={() => void launchSelected()} disabled={busy}>
                        {busy ? "Launching..." : "Open App"}
                      </Button>
                      <div className="text-xs text-muted-foreground flex items-center justify-between">
                        <span>Navigate</span>
                        <span className="font-mono">Arrow keys</span>
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center justify-between">
                        <span>Run selected</span>
                        <span className="font-mono">Enter</span>
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
