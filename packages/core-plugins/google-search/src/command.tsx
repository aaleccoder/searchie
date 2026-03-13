import * as React from "react";
import {
  PanelAside,
  PanelContainer,
  PanelFlex,
  PanelGrid,
  PanelHeading,
  PanelList,
  PanelListItem,
  PanelParagraph,
  PanelText,
  createPluginBackendSdk,
  usePanelArrowDownBridge,
  usePanelEnterBridge,
} from "@searchie/sdk";
import type { PanelCommandScope, PanelRenderProps } from "@searchie/sdk";

type GoogleSuggestion = {
  id: string;
  label: string;
};

const GOOGLE_SEARCH_BASE_URL = "https://www.google.com/search";
const SEARCH_DEBOUNCE_MS = 150;

const googleSearchCommandScope: PanelCommandScope = {
  pluginId: "runtime.google-search",
  id: "google-search.panel",
  capabilities: ["window.shell"],
};

function normalizeGoogleQuery(query: string): string {
  return query.trim();
}

function buildGoogleSearchUrl(query: string): string {
  const normalized = normalizeGoogleQuery(query);
  return `${GOOGLE_SEARCH_BASE_URL}?q=${encodeURIComponent(normalized)}`;
}

function parseGoogleSuggestResponse(payload: unknown): string[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  const suggestions = payload[1];
  if (!Array.isArray(suggestions)) {
    return [];
  }

  const cleaned = new Set<string>();
  for (const entry of suggestions) {
    if (typeof entry !== "string") {
      continue;
    }
    const trimmed = entry.trim();
    if (trimmed) {
      cleaned.add(trimmed);
    }
  }

  return [...cleaned];
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = React.useState(value);

  React.useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timeout);
  }, [delayMs, value]);

  return debounced;
}

export default function GoogleSearchPanel({
  commandQuery,
  registerInputArrowDownHandler,
  registerInputEnterHandler,
  focusLauncherInput,
}: PanelRenderProps): React.JSX.Element {
  const backend = React.useMemo(() => createPluginBackendSdk(googleSearchCommandScope), []);
  const debouncedQuery = useDebouncedValue(commandQuery, SEARCH_DEBOUNCE_MS);
  const normalizedQuery = React.useMemo(() => normalizeGoogleQuery(debouncedQuery), [debouncedQuery]);

  const [suggestions, setSuggestions] = React.useState<GoogleSuggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const itemRefs = React.useRef<Array<HTMLButtonElement | null>>([]);

  React.useEffect(() => {
    const selected = itemRefs.current[selectedIndex];
    selected?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  React.useEffect(() => {
    let cancelled = false;

    const runSearch = async () => {
      if (!normalizedQuery) {
        setSuggestions([]);
        setSelectedIndex(0);
        setErrorMessage(null);
        setBusy(false);
        return;
      }

      setBusy(true);
      setErrorMessage(null);

      try {
        const payload = await backend.window.googleSuggest(normalizedQuery);
        if (cancelled) {
          return;
        }

        const parsed = parseGoogleSuggestResponse(payload);
        const next = parsed.map((label) => ({ id: label, label }));
        if (!next.some((entry) => entry.label === normalizedQuery)) {
          next.unshift({ id: normalizedQuery, label: normalizedQuery });
        }

        setSuggestions(next.slice(0, 12));
        setSelectedIndex((current) => Math.max(0, Math.min(current, next.length - 1)));
      } catch (error) {
        if (cancelled) {
          return;
        }

        const fallback = normalizedQuery ? [{ id: normalizedQuery, label: normalizedQuery }] : [];
        setSuggestions(fallback);
        setSelectedIndex(0);
        setErrorMessage(error instanceof Error ? error.message : "Google suggestions failed");
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
  }, [backend.window, normalizedQuery]);

  const openSuggestion = React.useCallback(
    async (query: string) => {
      const url = buildGoogleSearchUrl(query);
      try {
        await backend.window.openUrl(url);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Could not open browser");
      }
    },
    [backend.window],
  );

  const moveSelection = React.useCallback(
    (delta: number) => {
      if (suggestions.length === 0) {
        return false;
      }

      setSelectedIndex((prev) => {
        if (delta < 0 && prev === 0) {
          focusLauncherInput?.();
          return 0;
        }

        const next = Math.max(0, Math.min(suggestions.length - 1, prev + delta));
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

  const onArrowDownFromLauncher = React.useCallback(() => {
    if (suggestions.length === 0) {
      return false;
    }

    setSelectedIndex(0);
    itemRefs.current[0]?.focus({ preventScroll: true });
    return true;
  }, [suggestions.length]);

  usePanelArrowDownBridge(registerInputArrowDownHandler, onArrowDownFromLauncher);
  usePanelEnterBridge(registerInputEnterHandler, activateSelection);

  const selectedSuggestion = suggestions[selectedIndex] ?? null;

  return (
    <PanelGrid columns="two-pane" gap="sm">
      <PanelContainer className="h-full min-h-0 overflow-hidden" surface="panel" padding="md">
        <PanelFlex direction="col" gap="sm" className="h-full min-h-0">
          <PanelHeading level={3}>Google Try</PanelHeading>

          {!normalizedQuery && (
            <PanelContainer surface="muted" padding="md">
              <PanelParagraph tone="muted">Search Google instantly. Type to get live suggestions.</PanelParagraph>
            </PanelContainer>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto">
            <PanelList gap="sm">
              {suggestions.map((entry, index) => (
                <PanelListItem
                  key={entry.id}
                  active={index === selectedIndex}
                  ref={(element) => {
                    itemRefs.current[index] = element;
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  onClick={() => {
                    setSelectedIndex(index);
                    void openSuggestion(entry.label);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      moveSelection(1);
                    } else if (event.key === "ArrowUp") {
                      event.preventDefault();
                      moveSelection(-1);
                    } else if (event.key === "Enter") {
                      event.preventDefault();
                      void openSuggestion(entry.label);
                    }
                  }}
                >
                  <PanelFlex align="center" justify="between" className="w-full min-w-0">
                    <PanelText size="sm" weight="medium" truncate>
                      {entry.label}
                    </PanelText>
                    <PanelText size="xs" tone="muted" mono>
                      Google
                    </PanelText>
                  </PanelFlex>
                </PanelListItem>
              ))}
            </PanelList>
          </div>

          {busy && <PanelText size="xs" tone="muted">Fetching suggestions...</PanelText>}
          {!busy && !!normalizedQuery && suggestions.length === 0 && !errorMessage && (
            <PanelText size="xs" tone="muted">No suggestions yet.</PanelText>
          )}
          {!!errorMessage && <PanelText size="xs" className="text-destructive">{errorMessage}</PanelText>}
        </PanelFlex>
      </PanelContainer>

      <PanelAside className="h-full">
        <PanelContainer surface="panel" padding="md" className="h-full">
          <PanelFlex direction="col" gap="sm">
            <PanelText size="xs" tone="muted" className="uppercase tracking-[0.08em]">
              Selected Query
            </PanelText>
            <PanelText size="lg" weight="semibold">
              {selectedSuggestion?.label ?? "-"}
            </PanelText>
            <PanelContainer surface="muted" padding="sm" className="mt-2">
              <PanelText size="xs" tone="muted">Press Enter to open in browser</PanelText>
            </PanelContainer>
          </PanelFlex>
        </PanelContainer>
      </PanelAside>
    </PanelGrid>
  );
}
