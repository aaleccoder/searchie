import * as React from "react";
import { Settings2 } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  PanelContainer,
  PanelInline,
  PanelList,
  PanelListItem,
  PanelParagraph,
  PanelScrollArea,
} from "@/components/framework/panel-primitives";
import { cn } from "@/lib/utils";
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
    <PanelContainer className="grid h-full grid-cols-[1.45fr_1fr] gap-2.5 items-stretch">
      <PanelContainer className="overflow-hidden h-full">
        <PanelScrollArea className="h-full">
          <PanelList className="p-0.5" gap="xs">
            {results.map((entry) => {
              const active = selected?.id === entry.id;
              return (
                <PanelListItem
                  key={entry.id}
                  type="button"
                  onMouseEnter={() => setSelectedId(entry.id)}
                  onFocus={() => setSelectedId(entry.id)}
                  onClick={() => {
                    setSelectedId(entry.id);
                    void openEntry(entry);
                  }}
                  className={cn(
                    "flex items-center justify-between gap-3 cursor-pointer",
                    active ? "bg-primary/10" : "border-transparent hover:bg-accent/50",
                  )}
                >
                  <PanelContainer className="flex items-center gap-3 min-w-0">
                    <PanelContainer className="rounded-sm bg-muted grid place-items-center size-6 shrink-0">
                      <Settings2 className="size-3.5 text-muted-foreground" />
                    </PanelContainer>
                    <PanelContainer className="min-w-0">
                      <PanelParagraph className="text-sm truncate">{entry.settingsPage}</PanelParagraph>
                      <PanelParagraph className="text-[11px] text-muted-foreground truncate">
                        {entry.uris[0]}
                      </PanelParagraph>
                    </PanelContainer>
                  </PanelContainer>
                  <PanelInline className="text-[11px] text-muted-foreground font-mono">Setting</PanelInline>
                </PanelListItem>
              );
            })}
            {results.length === 0 ? (
              <PanelContainer className="text-sm text-muted-foreground p-2.5">No settings found.</PanelContainer>
            ) : null}
          </PanelList>
        </PanelScrollArea>
      </PanelContainer>

      <PanelContainer className="h-full border border-border/70 rounded-lg p-3 space-y-2 overflow-hidden">
        {selected ? (
          <>
            <PanelParagraph className="text-xs uppercase tracking-wider text-muted-foreground">
              Selected Setting
            </PanelParagraph>
            <PanelParagraph className="text-base font-semibold leading-tight">{selected.settingsPage}</PanelParagraph>
            {selected.uris.map((uri) => (
              <button
                key={uri}
                type="button"
                className="w-full text-left rounded-md border border-border/60 px-2.5 py-2 text-xs hover:bg-accent/50"
                onClick={() => {
                  void openUrl(uri);
                }}
              >
                {uri}
              </button>
            ))}
          </>
        ) : (
          <PanelContainer className="h-full grid place-items-center text-sm text-muted-foreground">
            Select a setting to view URIs.
          </PanelContainer>
        )}
      </PanelContainer>
    </PanelContainer>
  );
}
