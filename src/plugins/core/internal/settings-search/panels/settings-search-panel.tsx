import * as React from "react";
import { Settings2 } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  PanelFlex,
  PanelGrid,
  PanelContainer,
  PanelInline,
  PanelList,
  PanelListItem,
  PanelParagraph,
  PanelText,
  PanelScrollArea,
} from "@/components/framework/panel-primitives";
import { loadSettingsCatalog } from "../lib/settings-search-catalog";
import {
  extractSettingsAliasQuery,
  searchSettingsEntries,
  type SettingsSearchEntry,
} from "../lib/settings-search-engine";

type SettingsSearchPanelProps = {
  commandQuery: string;
};

const SETTINGS_ALIASES = ["msettings", "wsettings", "configwin", "parametreswin", "winsettings"];

export function SettingsSearchPanel({ commandQuery }: SettingsSearchPanelProps) {
  const [catalog, setCatalog] = React.useState<SettingsSearchEntry[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      const loaded = await loadSettingsCatalog();
      if (!cancelled) {
        setCatalog(loaded);
      }
    };

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, []);

  const extracted = React.useMemo(
    () => extractSettingsAliasQuery(commandQuery, SETTINGS_ALIASES),
    [commandQuery],
  );

  const results = React.useMemo(() => searchSettingsEntries(catalog, extracted.query, 64), [catalog, extracted.query]);

  React.useEffect(() => {
    setSelectedId((previous) => {
      if (previous && results.some((item) => item.id === previous)) {
        return previous;
      }

      return results[0]?.id ?? null;
    });
  }, [results]);

  const selected = React.useMemo(() => {
    if (!selectedId) {
      return results[0] ?? null;
    }

    return results.find((item) => item.id === selectedId) ?? results[0] ?? null;
  }, [results, selectedId]);

  const openEntry = React.useCallback(async (entry: SettingsSearchEntry) => {
    const primary = entry.uris[0];
    if (!primary) {
      return;
    }

    try {
      await openUrl(primary);
    } catch (error) {
      console.error("[settings-search] failed to open URI", { uri: primary, error });
    }
  }, []);

  return (
    <PanelGrid columns="two-pane" gap="sm" style={{ height: "100%" }}>
      <PanelContainer style={{ overflow: "hidden", height: "100%" }}>
        <PanelScrollArea style={{ height: "100%" }}>
          <PanelList gap="xs">
            {results.map((entry) => {
              const active = selected?.id === entry.id;
              return (
                <PanelListItem
                  key={entry.id}
                  type="button"
                  active={active}
                  onMouseEnter={() => setSelectedId(entry.id)}
                  onFocus={() => setSelectedId(entry.id)}
                  onClick={() => {
                    setSelectedId(entry.id);
                    void openEntry(entry);
                  }}
                >
                  <PanelFlex align="center" justify="between" gap="sm" style={{ width: "100%" }}>
                    <PanelFlex align="center" gap="sm" style={{ minWidth: 0 }}>
                      <PanelContainer
                        radius="sm"
                        style={{
                          backgroundColor: "hsl(var(--muted))",
                          display: "grid",
                          placeItems: "center",
                          width: "1.5rem",
                          height: "1.5rem",
                          flexShrink: 0,
                        }}
                      >
                        <Settings2 size={14} style={{ color: "hsl(var(--muted-foreground))" }} />
                      </PanelContainer>
                      <PanelContainer>
                        <PanelParagraph size="sm" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {entry.settingsPage}
                        </PanelParagraph>
                        <PanelParagraph
                          size="xs"
                          tone="muted"
                          style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                        >
                          {entry.uris[0]}
                        </PanelParagraph>
                      </PanelContainer>
                    </PanelFlex>
                    <PanelInline size="xs" tone="muted" mono>
                      Setting
                    </PanelInline>
                  </PanelFlex>
                </PanelListItem>
              );
            })}
            {results.length === 0 ? (
              <PanelContainer padding="md">
                <PanelText size="sm" tone="muted">
                  No settings found.
                </PanelText>
              </PanelContainer>
            ) : null}
          </PanelList>
        </PanelScrollArea>
      </PanelContainer>

      <PanelContainer
        padding="md"
        radius="lg"
        style={{
          height: "100%",
          border: "1px solid color-mix(in oklab, hsl(var(--border)) 70%, transparent)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
        }}
      >
        {selected ? (
          <>
            <PanelParagraph
              size="xs"
              tone="muted"
              style={{
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Selected Setting
            </PanelParagraph>
            <PanelParagraph size="md" style={{ fontWeight: 600, lineHeight: 1.2 }}>
              {selected.settingsPage}
            </PanelParagraph>
            {selected.uris.map((uri) => (
              <button
                key={uri}
                type="button"
                style={{
                  width: "100%",
                  textAlign: "left",
                  borderRadius: "0.375rem",
                  border: "1px solid color-mix(in oklab, hsl(var(--border)) 60%, transparent)",
                  padding: "0.5rem 0.625rem",
                  fontSize: "0.75rem",
                  background: "transparent",
                  cursor: "pointer",
                }}
                onClick={() => {
                  void openUrl(uri);
                }}
              >
                {uri}
              </button>
            ))}
          </>
        ) : (
          <PanelContainer style={{ height: "100%", display: "grid", placeItems: "center" }}>
            <PanelText size="sm" tone="muted">
              Select a setting to view URIs.
            </PanelText>
          </PanelContainer>
        )}
      </PanelContainer>
    </PanelGrid>
  );
}
