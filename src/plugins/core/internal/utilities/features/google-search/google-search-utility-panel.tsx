import * as React from "react";
import { Globe, Search, ExternalLink, RotateCw } from "lucide-react";
import { useHotkey } from "@tanstack/react-hotkeys";
import {
  Empty as PanelEmpty,
  EmptyDescription as PanelEmptyDescription,
  EmptyHeader as PanelEmptyHeader,
  EmptyMedia as PanelEmptyMedia,
  EmptyTitle as PanelEmptyTitle,
  Grid as PanelGrid,
  List as PanelList,
  ListItem as PanelListItem,
  ScrollArea as PanelScrollArea,
  PanelAside,
  PanelContainer,
  PanelFlex,
  PanelText,
  Kbd as PanelKbd,
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
import type { PanelFooterConfig } from "@/lib/panel-contract";
import type { PanelCommandScope } from "@/lib/tauri-commands";
import {
  buildGoogleSearchUrl,
  buildGoogleSuggestUrl,
  parseGoogleSuggestResponse,
  normalizeGoogleQuery,
} from "@/lib/utilities/google-search-engine";
import { registerGoogleSearchInputController } from "./google-search-keybindings";

type GoogleSearchUtilityPanelProps = {
  commandQuery: string;
  registerInputArrowDownHandler?: ((handler: (() => boolean | void) | null) => void) | undefined;
  registerInputEnterHandler?: ((handler: (() => boolean | void) | null) => void) | undefined;
  registerPanelFooter?: ((footer: PanelFooterConfig | null) => void) | undefined;
  focusLauncherInput?: (() => void) | undefined;
};

type GoogleSuggestion = {
  id: string;
  label: string;
};

const googleSearchCommandScope: PanelCommandScope = {
  pluginId: "core.utilities",
  id: "utilities-google-search",
  capabilities: ["window.shell"],
};

const SEARCH_DEBOUNCE_MS = 150;

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = React.useState(value);

  React.useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timeout);
  }, [value, delayMs]);

  return debounced;
}

export function GoogleSearchUtilityPanel({
  commandQuery,
  registerInputArrowDownHandler,
  registerInputEnterHandler,
  registerPanelFooter,
  focusLauncherInput,
}: GoogleSearchUtilityPanelProps) {
  const backend = React.useMemo(() => createPluginBackendSdk(googleSearchCommandScope), []);
  const [suggestions, setSuggestions] = React.useState<GoogleSuggestion[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const { controlsRef: footerControlsRef, registerFooterControls } = usePanelFooterControlsRef();

  const itemRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const debouncedQuery = useDebouncedValue(commandQuery, SEARCH_DEBOUNCE_MS);

  const normalizedQuery = React.useMemo(() => normalizeGoogleQuery(debouncedQuery), [debouncedQuery]);

  const onArrowDownFromLauncher = React.useCallback(() => {
    if (suggestions.length === 0) {
      return false;
    }

    setSelectedIndex(0);
    itemRefs.current[0]?.focus({ preventScroll: true });
    return true;
  }, [suggestions.length]);

  usePanelArrowDownBridge(registerInputArrowDownHandler, onArrowDownFromLauncher);

  React.useEffect(() => {
    const selected = itemRefs.current[selectedIndex];
    selected?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  React.useEffect(() => {
    let cancelled = false;

    const runSearch = async () => {
      const trimmed = normalizedQuery;
      if (!trimmed) {
        setSuggestions([]);
        setErrorMessage(null);
        setSelectedIndex(0);
        return;
      }

      setBusy(true);
      setErrorMessage(null);

      try {
        const url = buildGoogleSuggestUrl(trimmed);
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Google suggest failed: ${response.status}`);
        }

        const payload = await response.json();
        if (cancelled) {
          return;
        }

        const parsed = parseGoogleSuggestResponse(payload);
        const next = parsed.map((label) => ({ id: label, label }));
        if (!next.some((entry) => entry.label === trimmed)) {
          next.unshift({ id: trimmed, label: trimmed });
        }

        setSuggestions(next.slice(0, 12));
        setSelectedIndex((current) => Math.min(current, next.length - 1));
      } catch (error) {
        if (cancelled) {
          return;
        }
        const fallback = trimmed ? [{ id: trimmed, label: trimmed }] : [];
        setSuggestions(fallback);
        setSelectedIndex(0);
        setErrorMessage(error instanceof Error ? error.message : "Google search suggestions failed");
      } finally {
        if (!cancelled) {
          setBusy(false);
        }
      }
    };

    void runSearch();
    return () => {
      cancelled = true;
    };
  }, [normalizedQuery]);

  const openSuggestion = React.useCallback(
    async (query: string) => {
      const url = buildGoogleSearchUrl(query);
      try {
        await backend.window.openUrl(url);
      } catch (error) {
        console.error("[google-search] open failed", error);
        setErrorMessage(error instanceof Error ? error.message : "Could not open browser");
      }
    },
    [backend.window],
  );

  const selectedSuggestion = suggestions[selectedIndex] ?? null;

  const footerConfig = React.useMemo<PanelFooterConfig | null>(() => {
    if (!selectedSuggestion) {
      return null;
    }

    return {
      panel: {
        title: "Google Search",
        icon: Globe,
      },
      registerControls: registerFooterControls,
      primaryAction: {
        id: "open-google-result",
        label: "Open in Browser",
        icon: ExternalLink,
        onSelect: () => {
          void openSuggestion(selectedSuggestion.label);
        },
        disabled: !selectedSuggestion.label.trim(),
        shortcutHint: "Enter",
      },
      extraActions: [
        {
          id: "back-to-input",
          label: "Back To Input",
          icon: RotateCw,
          onSelect: () => {
            focusLauncherInput?.();
          },
          shortcutHint: "Alt+I",
        },
      ],
    };
  }, [focusLauncherInput, openSuggestion, registerFooterControls, selectedSuggestion]);

  usePanelFooter(registerPanelFooter, footerConfig);

  const moveSelection = React.useCallback(
    (delta: number) => {
      if (suggestions.length === 0) {
        return false;
      }

      setSelectedIndex((prev) => {
        const next = Math.max(0, Math.min(suggestions.length - 1, prev + delta));
        if (delta < 0 && prev === 0) {
          focusLauncherInput?.();
          return 0;
        }
        itemRefs.current[next]?.focus({ preventScroll: true });
        return next;
      });
      return true;
    },
    [focusLauncherInput, suggestions.length],
  );

  const activateSelection = React.useCallback(() => {
    const selected = suggestions[selectedIndex];
    if (!selected) {
      return false;
    }

    void openSuggestion(selected.label);
    return true;
  }, [openSuggestion, selectedIndex, suggestions]);

  React.useEffect(() => {
    registerGoogleSearchInputController({ moveSelection, activateSelection });
    return () => {
      registerGoogleSearchInputController(null);
    };
  }, [activateSelection, moveSelection]);

  usePanelEnterBridge(registerInputEnterHandler, () => activateSelection());

  useHotkey(
    "ArrowDown",
    () => {
      void moveSelection(1);
    },
    { enabled: suggestions.length > 0, preventDefault: true },
  );

  useHotkey(
    "ArrowUp",
    () => {
      void moveSelection(-1);
    },
    { enabled: suggestions.length > 0, preventDefault: true },
  );

  useHotkey(
    "Enter",
    () => {
      void activateSelection();
    },
    { enabled: !!selectedSuggestion, preventDefault: true },
  );

  useHotkey(
    "Alt+K",
    () => {
      footerControlsRef.current?.openExtraActions();
    },
    { enabled: !!selectedSuggestion, preventDefault: true },
  );

  return (
    <PanelTooltipProvider>
      <PanelGrid columns="two-pane" gap="sm" style={{ height: "100%" }}>
        <PanelContainer style={{ height: "100%", overflow: "hidden" }}>
          <PanelScrollArea style={{ height: "100%" }}>
            <PanelContainer padding="md">
              <PanelList gap="sm">
                {suggestions.map((entry, index) => {
                  const active = index === selectedIndex;
                  return (
                    <PanelListItem
                      key={entry.id}
                      active={active}
                      ref={(el) => {
                        itemRefs.current[index] = el;
                      }}
                      onMouseEnter={() => setSelectedIndex(index)}
                      onClick={() => {
                        setSelectedIndex(index);
                        void openSuggestion(entry.label);
                      }}
                    >
                      <PanelFlex align="center" justify="between" gap="sm" style={{ width: "100%" }}>
                        <PanelFlex align="center" gap="sm" style={{ minWidth: 0 }}>
                          <PanelContainer
                            radius="sm"
                            style={{
                              width: "1.5rem",
                              height: "1.5rem",
                              display: "grid",
                              placeItems: "center",
                              backgroundColor: "color-mix(in oklab, hsl(var(--muted)) 65%, transparent)",
                              flexShrink: 0,
                            }}
                          >
                            <Search size={14} style={{ color: "hsl(var(--muted-foreground))" }} />
                          </PanelContainer>
                          <PanelText size="sm" weight="medium" truncate>
                            {entry.label}
                          </PanelText>
                        </PanelFlex>
                        <PanelText size="xs" tone="muted" mono>
                          Google
                        </PanelText>
                      </PanelFlex>
                    </PanelListItem>
                  );
                })}
              </PanelList>

              {!busy && !errorMessage && suggestions.length === 0 && normalizedQuery.length > 0 && (
                <PanelContainer surface="muted" padding="md">
                  <PanelEmpty>
                    <PanelEmptyHeader>
                      <PanelEmptyMedia variant="icon">
                        <Search size={20} />
                      </PanelEmptyMedia>
                      <PanelEmptyTitle>No suggestions yet</PanelEmptyTitle>
                      <PanelEmptyDescription>
                        Keep typing to fetch Google suggestions.
                      </PanelEmptyDescription>
                    </PanelEmptyHeader>
                  </PanelEmpty>
                </PanelContainer>
              )}

              {!busy && !errorMessage && normalizedQuery.length === 0 && (
                <PanelContainer surface="muted" padding="md">
                  <PanelEmpty>
                    <PanelEmptyHeader>
                      <PanelEmptyMedia variant="icon">
                        <Globe size={20} />
                      </PanelEmptyMedia>
                      <PanelEmptyTitle>Search Google instantly</PanelEmptyTitle>
                      <PanelEmptyDescription>
                        Type your query to see suggestions.
                      </PanelEmptyDescription>
                    </PanelEmptyHeader>
                  </PanelEmpty>
                </PanelContainer>
              )}

              {busy && (
                <PanelContainer style={{ display: "grid", height: "6rem", placeItems: "center" }}>
                  <PanelText size="xs" tone="muted">
                    Fetching suggestions...
                  </PanelText>
                </PanelContainer>
              )}
            </PanelContainer>
          </PanelScrollArea>
        </PanelContainer>

        <PanelAside style={{ height: "100%" }}>
          <PanelContainer padding="md" style={{ height: "100%" }}>
            <PanelFlex direction="col" gap="md" style={{ height: "100%" }}>
              <PanelContainer>
                <PanelText size="xs" tone="muted" style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Selected Query
                </PanelText>
                <PanelText size="lg" weight="semibold" style={{ marginTop: "0.5rem" }}>
                  {selectedSuggestion?.label ?? "-"}
                </PanelText>
              </PanelContainer>

              <PanelContainer surface="muted" padding="md">
                <PanelFlex direction="col" gap="sm">
                  <PanelText size="xs" tone="muted">
                    Action
                  </PanelText>
                  <PanelFlex align="center" justify="between">
                    <PanelText size="sm">Open in browser</PanelText>
                    <PanelKbd>Enter</PanelKbd>
                  </PanelFlex>
                </PanelFlex>
              </PanelContainer>

              {errorMessage && (
                <PanelContainer
                  padding="sm"
                  radius="md"
                  style={{
                    border: "1px solid color-mix(in oklab, hsl(var(--destructive)) 30%, transparent)",
                    backgroundColor: "color-mix(in oklab, hsl(var(--destructive)) 10%, transparent)",
                  }}
                >
                  <PanelText size="xs" style={{ color: "hsl(var(--destructive))" }}>
                    {errorMessage}
                  </PanelText>
                </PanelContainer>
              )}

              <PanelContainer style={{ marginTop: "auto" }}>
                <PanelTooltip>
                  <PanelTooltipTrigger>
                    <PanelFlex align="center" justify="between" style={{ cursor: "help" }}>
                      <PanelText size="xs" tone="muted">
                        Provider
                      </PanelText>
                      <PanelText size="xs" tone="muted" mono>
                        Google
                      </PanelText>
                    </PanelFlex>
                  </PanelTooltipTrigger>
                  <PanelTooltipContent side="top" align="end">
                    <PanelText size="xs">Suggestions via Google autocomplete</PanelText>
                  </PanelTooltipContent>
                </PanelTooltip>
              </PanelContainer>
            </PanelFlex>
          </PanelContainer>
        </PanelAside>
      </PanelGrid>
    </PanelTooltipProvider>
  );
}
