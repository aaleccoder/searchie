import * as React from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Rocket } from "lucide-react";
import { LauncherSearchInput } from "@/components/launcher-search-input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ShortcutPanelDescriptor } from "@/lib/panel-contract";
import { usePanelRegistry } from "@/lib/panel-registry";
import { cn } from "@/lib/utils";

type PanelCommandSuggestion = {
  id: string;
  panel: ShortcutPanelDescriptor;
  commandQuery: string;
  matchAlias?: string;
};

type LauncherPanelProps = {
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onOpenSettings: () => void;
  openSettingsRequestKey?: number;
};

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = React.useState(value);

  React.useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timeout);
  }, [value, delayMs]);

  return debounced;
}

export function LauncherPanel({
  expanded,
  onExpandedChange,
  onOpenSettings,
  openSettingsRequestKey = 0,
}: LauncherPanelProps) {
  const panelRegistry = usePanelRegistry();
  const registeredPanels = React.useMemo(() => panelRegistry.list(), [panelRegistry]);
  const [query, setQuery] = React.useState("");
  const debouncedQuery = useDebouncedValue(query, 80);
  const [selectedCommandId, setSelectedCommandId] = React.useState<string | null>(null);
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

  const defaultPanel = React.useMemo(() => {
    if (activePanelSession || immediatePanelResolution) {
      return null;
    }

    return registeredPanels.find((panel) => panel.isDefault) ?? null;
  }, [activePanelSession, immediatePanelResolution, registeredPanels]);

  const activePanel = activePanelSession?.panel ?? immediatePanelResolution?.panel ?? defaultPanel;
  const activePanelQuery = activePanelSession
    ? query
    : immediatePanelResolution
      ? immediatePanelResolution.match.commandQuery
      : query;
  const searchPlaceholder = activePanel?.searchIntegration?.placeholder ?? "Search apps...";
  const settingsPanel = React.useMemo(
    () => registeredPanels.find((panel) => panel.id === "settings") ?? null,
    [registeredPanels],
  );
  const hotkeysPanel = React.useMemo(
    () => registeredPanels.find((panel) => panel.id === "hotkeys") ?? null,
    [registeredPanels],
  );

  const inputRef = React.useRef<HTMLInputElement>(null);
  const itemRefs = React.useRef<Map<string, HTMLButtonElement>>(new Map());
  const activePanelArrowDownHandlerRef = React.useRef<(() => boolean | void) | null>(null);
  const activePanelEnterHandlerRef = React.useRef<(() => boolean | void) | null>(null);

  const registerInputArrowDownHandler = React.useCallback((handler: (() => boolean | void) | null) => {
    activePanelArrowDownHandlerRef.current = handler;
  }, []);

  const registerInputEnterHandler = React.useCallback((handler: (() => boolean | void) | null) => {
    activePanelEnterHandlerRef.current = handler;
  }, []);

  const focusLauncherInput = React.useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const clearLauncherInput = React.useCallback(() => {
    setQuery("");
  }, []);

  const closeLauncherWindow = React.useCallback(() => {
    onExpandedChange(false);
    void getCurrentWindow().hide();
  }, [onExpandedChange]);

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
      // Keep panel sessions visible even when their internal filter query is cleared.
      const shouldExpand = !!activePanelSession || next.trim().length > 0;
      if (shouldExpand !== expanded) {
        onExpandedChange(shouldExpand);
      }
    },
    [activePanelSession, expanded, onExpandedChange],
  );

  const openSettingsPanel = React.useCallback(() => {
    if (settingsPanel) {
      activatePanelSession(settingsPanel, "");
      return;
    }
    onOpenSettings();
  }, [activatePanelSession, onOpenSettings, settingsPanel]);

  const openHotkeysPanel = React.useCallback(() => {
    if (!hotkeysPanel) {
      return;
    }

    const contextPanelId = activePanel?.id ?? "launcher";
    activatePanelSession(hotkeysPanel, contextPanelId);
  }, [activatePanelSession, activePanel?.id, hotkeysPanel]);

  React.useEffect(() => {
    if (openSettingsRequestKey <= 0) {
      return;
    }

    openSettingsPanel();
  }, [openSettingsPanel, openSettingsRequestKey]);

  React.useEffect(() => {
    if (!activePanel) {
      activePanelArrowDownHandlerRef.current = null;
      activePanelEnterHandlerRef.current = null;
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

  const panelCommandSuggestions = React.useMemo<PanelCommandSuggestion[]>(() => {
    if (activePanel) {
      return [];
    }

    const trimmed = debouncedQuery.trim().toLowerCase();
    const allPanels = registeredPanels.filter((panel) => !panel.isDefault);
    const toSuggestion = (panel: ShortcutPanelDescriptor, commandQuery: string, matchAlias?: string) => ({
      id: `panel-command:${panel.id}`,
      panel,
      commandQuery,
      matchAlias,
    });

    if (!trimmed) {
      return allPanels.map((panel) => toSuggestion(panel, "", panel.aliases[0]));
    }

    const exactMatches: PanelCommandSuggestion[] = [];
    const fuzzyMatches: PanelCommandSuggestion[] = [];

    for (const panel of allPanels) {
      const match = panel.matcher(query);
      if (match.matches) {
        exactMatches.push(toSuggestion(panel, match.commandQuery, panel.aliases[0]));
        continue;
      }

      const aliasMatch = panel.aliases.some((alias) => alias.toLowerCase().includes(trimmed));
      const nameMatch = panel.name.toLowerCase().includes(trimmed);
      if (aliasMatch || nameMatch) {
        fuzzyMatches.push(toSuggestion(panel, query, panel.aliases[0]));
      }
    }

    return [...exactMatches, ...fuzzyMatches].slice(0, 24);
  }, [activePanel, debouncedQuery, query, registeredPanels]);

  React.useEffect(() => {
    setSelectedCommandId((previous) => {
      if (previous && panelCommandSuggestions.some((suggestion) => suggestion.id === previous)) {
        return previous;
      }
      return panelCommandSuggestions[0]?.id ?? null;
    });
  }, [panelCommandSuggestions]);

  React.useEffect(() => {
    if (!selectedCommandId) return;
    const target = itemRefs.current.get(selectedCommandId);
    if (target && typeof target.scrollIntoView === "function") {
      target.scrollIntoView({ block: "nearest" });
    }
  }, [selectedCommandId]);

  const activateSelectedCommand = React.useCallback(() => {
    if (!panelCommandSuggestions.length) {
      return;
    }

    const selected =
      panelCommandSuggestions.find((suggestion) => suggestion.id === selectedCommandId) ??
      panelCommandSuggestions[0];
    if (!selected) {
      return;
    }

    activatePanelSession(selected.panel, selected.commandQuery);
  }, [activatePanelSession, panelCommandSuggestions, selectedCommandId]);

  const moveSelection = React.useCallback(
    (delta: number) => {
      if (!panelCommandSuggestions.length) return;
      const index = Math.max(
        0,
        panelCommandSuggestions.findIndex((item) => item.id === (selectedCommandId ?? "")),
      );
      const next = Math.max(0, Math.min(panelCommandSuggestions.length - 1, index + delta));
      setSelectedCommandId(panelCommandSuggestions[next]?.id ?? null);
    },
    [panelCommandSuggestions, selectedCommandId],
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
      moveSelection(1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveSelection(-1);
      return;
    }
    if (event.key === "Enter") {
      if (activePanel) {
        const consumed = activePanelEnterHandlerRef.current?.();
        if (consumed !== false) {
          event.preventDefault();
        }
        return;
      }
      event.preventDefault();
      activateSelectedCommand();
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
      } else {
        closeLauncherWindow();
      }
    }
  };

  const isInputFocused = React.useCallback(() => {
    return document.activeElement === inputRef.current;
  }, []);

  React.useEffect(() => {
    if (activePanel) {
      return;
    }

    const onDocumentKeyDown = (event: KeyboardEvent) => {
      if (isInputFocused()) {
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        moveSelection(1);
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        moveSelection(-1);
      }
    };

    document.addEventListener("keydown", onDocumentKeyDown);
    return () => {
      document.removeEventListener("keydown", onDocumentKeyDown);
    };
  }, [activePanel, isInputFocused, moveSelection]);

  const selectedCommand = React.useMemo(() => {
    if (!selectedCommandId) {
      return panelCommandSuggestions[0] ?? null;
    }

    return (
      panelCommandSuggestions.find((suggestion) => suggestion.id === selectedCommandId) ??
      panelCommandSuggestions[0] ??
      null
    );
  }, [panelCommandSuggestions, selectedCommandId]);

  return (
    <div className="relative h-screen w-200 max-w-200 text-foreground overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.1),transparent_52%),radial-gradient(circle_at_bottom_right,hsl(var(--ring)/0.12),transparent_55%)]" />

      <LauncherSearchInput
        value={query}
        placeholder={searchPlaceholder}
        inputRef={inputRef}
        onValueChange={handleInputValueChange}
        onKeyDown={handleKeyDown}
        onOpenSettings={openSettingsPanel}
        onOpenHotkeysHelp={openHotkeysPanel}
      />

      <div
        className={cn(
          "relative overflow-hidden transition-[height,opacity,padding] duration-220 ease-out motion-reduce:transition-none",
          expanded
            ? "h-[calc(100%-2.5rem)] p-2.5 opacity-100"
            : "h-0 px-2.5 py-0 opacity-0 pointer-events-none",
        )}
      >
        {expanded ? (
          activePanel ? (
            <activePanel.component
              commandQuery={activePanelQuery}
              rawQuery={query}
              registerInputArrowDownHandler={registerInputArrowDownHandler}
              registerInputEnterHandler={registerInputEnterHandler}
              focusLauncherInput={focusLauncherInput}
              clearLauncherInput={clearLauncherInput}
              closeLauncherWindow={closeLauncherWindow}
              activatePanelSession={activatePanelSession}
            />
          ) : (
            <div className="h-full rounded-xl border border-border/70 bg-card/92 shadow-lg overflow-hidden">
              <ScrollArea className="h-full">
                <div className="p-4 space-y-4">
                  <div className="space-y-1">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Launcher</p>
                    <h2 className="text-base font-semibold leading-tight">Command Panels</h2>
                    <p className="text-xs text-muted-foreground">
                      Type a panel command and press Enter to open it.
                    </p>
                  </div>

                  {panelCommandSuggestions.length > 0 ? (
                    <div className="flex flex-col gap-1.5">
                      {panelCommandSuggestions.map((suggestion) => {
                        const CommandIcon = suggestion.panel.commandIcon ?? Rocket;
                        const active = selectedCommand?.id === suggestion.id;
                        return (
                          <button
                            key={suggestion.id}
                            type="button"
                            ref={(el) => {
                              if (el) itemRefs.current.set(suggestion.id, el);
                              else itemRefs.current.delete(suggestion.id);
                            }}
                            onMouseEnter={() => setSelectedCommandId(suggestion.id)}
                            onClick={() => {
                              setSelectedCommandId(suggestion.id);
                              activatePanelSession(suggestion.panel, suggestion.commandQuery);
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
                              <div className="min-w-0">
                                <p className="text-sm line-clamp-1">Open {suggestion.panel.name}</p>
                                {suggestion.matchAlias ? (
                                  <p className="text-[11px] text-muted-foreground font-mono line-clamp-1">
                                    {suggestion.matchAlias}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                            <span className="text-[11px] text-muted-foreground font-mono">Command</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                      No matching panel command.
                    </div>
                  )}

                  <div className="text-xs text-muted-foreground flex items-center justify-between">
                    <span>Navigate / Open</span>
                    <span className="font-mono">Up Down + Enter</span>
                  </div>
                </div>
              </ScrollArea>
            </div>
          )
        ) : null}
      </div>
    </div>
  );
}
