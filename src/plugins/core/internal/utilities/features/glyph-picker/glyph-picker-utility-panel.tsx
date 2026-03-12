import * as React from "react";
import { useHotkey } from "@tanstack/react-hotkeys";
import { Copy, Shapes } from "lucide-react";
import { toast } from "sonner";
import {
  Badge as PanelBadge,
  Button as PanelButton,
  Empty as PanelEmpty,
  EmptyDescription as PanelEmptyDescription,
  EmptyHeader as PanelEmptyHeader,
  EmptyMedia as PanelEmptyMedia,
  EmptyTitle as PanelEmptyTitle,
  Grid as PanelGrid,
  List as PanelList,
  ListItem as PanelListItem,
  PanelAside,
  PanelContainer,
  PanelFlex,
  PanelSection,
  PanelText,
  ScrollArea as PanelScrollArea,
  usePanelArrowDownBridge,
  usePanelEnterBridge,
  usePanelFooter,
  usePanelFooterControlsRef,
} from "@/plugins/sdk";
import type { PanelFooterConfig } from "@/lib/panel-contract";
import {
  filterGlyphEntries,
  GLYPH_ENTRIES,
  loadEmojiEntriesFromUnicodeData,
  parseGlyphPickerQuery,
  type GlyphEntry,
  type GlyphPickerQuery,
} from "@/lib/utilities/glyph-picker-engine";
import { registerGlyphPickerInputController } from "./glyph-picker-keybindings";

type GlyphPickerUtilityPanelProps = {
  commandQuery: string;
  registerInputArrowDownHandler?: ((handler: (() => boolean | void) | null) => void) | undefined;
  registerInputEnterHandler?: ((handler: (() => boolean | void) | null) => void) | undefined;
  registerPanelFooter?: ((footer: PanelFooterConfig | null) => void) | undefined;
  focusLauncherInput?: (() => void) | undefined;
};

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = React.useState(value);

  React.useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timeout);
  }, [value, delayMs]);

  return debounced;
}

const CATEGORY_ORDER: Array<GlyphPickerQuery["category"]> = ["all", "emoji", "emoticon", "symbol"];

function categoryLabel(category: GlyphPickerQuery["category"]): string {
  if (category === "all") return "All";
  if (category === "emoji") return "Emoji";
  if (category === "emoticon") return "Emoticons";
  return "Else";
}

export function GlyphPickerUtilityPanel({
  commandQuery,
  registerInputArrowDownHandler,
  registerInputEnterHandler,
  registerPanelFooter,
  focusLauncherInput,
}: GlyphPickerUtilityPanelProps) {
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [focusArea, setFocusArea] = React.useState<"list" | "actions">("list");
  const [selectedActionIndex, setSelectedActionIndex] = React.useState(0);
  const [loadedEmojiEntries, setLoadedEmojiEntries] = React.useState<GlyphEntry[]>([]);
  const { controlsRef: footerControlsRef, registerFooterControls } = usePanelFooterControlsRef();
  const itemRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const actionRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const debouncedQuery = useDebouncedValue(commandQuery, 80);

  React.useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const entries = await loadEmojiEntriesFromUnicodeData();
      if (!cancelled && entries.length > 0) {
        setLoadedEmojiEntries(entries);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const sourceEntries = React.useMemo(() => {
    const nonEmoji = GLYPH_ENTRIES.filter((entry) => entry.kind !== "emoji");
    if (loadedEmojiEntries.length === 0) {
      return GLYPH_ENTRIES;
    }
    return [...loadedEmojiEntries, ...nonEmoji];
  }, [loadedEmojiEntries]);

  const parsedQuery = React.useMemo(() => parseGlyphPickerQuery(debouncedQuery), [debouncedQuery]);
  const filtered = React.useMemo(
    () => filterGlyphEntries(sourceEntries, parsedQuery),
    [parsedQuery, sourceEntries],
  );

  React.useEffect(() => {
    setSelectedIndex((current) => {
      if (filtered.length === 0) {
        return 0;
      }
      return Math.min(current, filtered.length - 1);
    });
  }, [filtered]);

  const selected = filtered[selectedIndex] ?? null;

  React.useEffect(() => {
    const item = itemRefs.current[selectedIndex];
    if (item && typeof item.scrollIntoView === "function") {
      item.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  React.useEffect(() => {
    if (focusArea === "actions") {
      actionRefs.current[selectedActionIndex]?.focus();
    }
  }, [focusArea, selectedActionIndex]);

  const counts = React.useMemo(() => {
    return {
      all: filtered.length,
      emoji: filtered.filter((entry) => entry.kind === "emoji").length,
      emoticon: filtered.filter((entry) => entry.kind === "emoticon").length,
      symbol: filtered.filter((entry) => entry.kind === "symbol").length,
    };
  }, [filtered]);

  const copyEntry = React.useCallback(async (entry: GlyphEntry) => {
    try {
      await navigator.clipboard.writeText(entry.value);
      toast.success("Copied", {
        description: `${entry.value} ${entry.label}`,
      });
    } catch (error) {
      console.error("[glyph-picker] copy failed", error);
      toast.error("Could not copy symbol", {
        description: "Clipboard access is blocked or unavailable.",
      });
    }
  }, []);

  const footerConfig = React.useMemo<PanelFooterConfig | null>(() => {
    if (!selected) {
      return null;
    }

    return {
      panel: {
        title: "Glyph Picker",
        icon: Shapes,
      },
      registerControls: registerFooterControls,
      primaryAction: {
        id: "copy-glyph",
        label: "Copy Glyph",
        icon: Copy,
        onSelect: () => {
          void copyEntry(selected);
        },
        shortcutHint: "Enter",
      },
      extraActions: [
        {
          id: "copy-label",
          label: "Copy Label",
          onSelect: () => {
            void navigator.clipboard.writeText(selected.label);
          },
          shortcutHint: "Alt+L",
        },
        {
          id: "focus-input",
          label: "Back To Input",
          onSelect: () => {
            focusLauncherInput?.();
          },
          shortcutHint: "Alt+I",
        },
      ],
    };
  }, [copyEntry, focusLauncherInput, registerFooterControls, selected]);

  usePanelFooter(registerPanelFooter, footerConfig);

  const activateCurrentAction = React.useCallback(() => {
    if (!selected) {
      return false;
    }

    if (focusArea === "actions" && selectedActionIndex === 1) {
      focusLauncherInput?.();
      return true;
    }

    void copyEntry(selected);
    return true;
  }, [copyEntry, focusArea, focusLauncherInput, selected, selectedActionIndex]);

  const moveSelection = React.useCallback(
    (delta: number) => {
      if (filtered.length === 0) {
        return false;
      }
      setFocusArea("list");
      setSelectedIndex((current) => {
        const next = Math.max(0, Math.min(filtered.length - 1, current + delta));
        return next;
      });
      return true;
    },
    [filtered.length],
  );

  const focusActions = React.useCallback(() => {
    if (!selected) {
      return false;
    }
    setFocusArea("actions");
    setSelectedActionIndex(0);
    return true;
  }, [selected]);

  const focusList = React.useCallback(() => {
    if (focusArea === "actions") {
      setFocusArea("list");
      itemRefs.current[selectedIndex]?.focus();
      return true;
    }
    focusLauncherInput?.();
    return true;
  }, [focusArea, focusLauncherInput, selectedIndex]);

  React.useEffect(() => {
    registerGlyphPickerInputController({
      moveSelection,
      focusActions,
      focusList,
      activateSelection: activateCurrentAction,
      focusLauncherInput: () => {
        focusLauncherInput?.();
        return true;
      },
    });

    return () => {
      registerGlyphPickerInputController(null);
    };
  }, [activateCurrentAction, focusActions, focusLauncherInput, focusList, moveSelection]);

  usePanelArrowDownBridge(registerInputArrowDownHandler, () => moveSelection(1));
  usePanelEnterBridge(registerInputEnterHandler, activateCurrentAction);

  useHotkey(
    "ArrowDown",
    () => {
      if (focusArea === "actions") {
        setSelectedActionIndex((current) => Math.min(current + 1, 1));
        return;
      }
      void moveSelection(1);
    },
    { enabled: filtered.length > 0, preventDefault: true },
  );

  useHotkey(
    "ArrowUp",
    () => {
      if (focusArea === "actions") {
        setSelectedActionIndex((current) => {
          const next = Math.max(0, current - 1);
          if (next === 0 && current === 0) {
            setFocusArea("list");
            itemRefs.current[selectedIndex]?.focus();
          }
          return next;
        });
        return;
      }
      if (selectedIndex === 0) {
        focusLauncherInput?.();
        return;
      }
      void moveSelection(-1);
    },
    { enabled: filtered.length > 0, preventDefault: true },
  );

  useHotkey(
    "ArrowRight",
    () => {
      void focusActions();
    },
    { enabled: !!selected, preventDefault: true },
  );

  useHotkey(
    "ArrowLeft",
    () => {
      void focusList();
    },
    { enabled: filtered.length > 0, preventDefault: true },
  );

  useHotkey(
    "Escape",
    () => {
      focusLauncherInput?.();
    },
    { enabled: !!focusLauncherInput, preventDefault: true },
  );

  useHotkey(
    "Enter",
    () => {
      void activateCurrentAction();
    },
    { enabled: !!selected, preventDefault: true },
  );

  useHotkey(
    "Alt+K",
    () => {
      footerControlsRef.current?.openExtraActions();
    },
    { enabled: !!selected, preventDefault: true },
  );

  useHotkey(
    "Alt+L",
    () => {
      const handled = footerControlsRef.current?.runExtraActionById("copy-label") ?? false;
      if (!handled && selected) {
        void navigator.clipboard.writeText(selected.label);
      }
    },
    { enabled: !!selected, preventDefault: true },
  );

  useHotkey(
    "Alt+I",
    () => {
      const handled = footerControlsRef.current?.runExtraActionById("focus-input") ?? false;
      if (!handled) {
        focusLauncherInput?.();
      }
    },
    { enabled: !!selected, preventDefault: true },
  );

  return (
    <PanelGrid columns="two-pane" gap="sm" style={{ height: "100%" }}>
      <PanelSection style={{ height: "100%", overflow: "hidden" }}>
        <PanelContainer
          padding="md"
          style={{
            borderBottom: "1px solid color-mix(in oklab, hsl(var(--border)) 40%, transparent)",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          <PanelText size="xs" tone="muted">
            Use launcher input: <code>emoji smile</code>, <code>emoticon shrug</code>, <code>else arrow</code>
          </PanelText>
          <PanelFlex gap="xs" style={{ flexWrap: "wrap" }}>
            {CATEGORY_ORDER.map((category) => {
              const active = parsedQuery.category === category;
              const count = counts[category];
              return (
                <PanelButton
                  key={category}
                  type="button"
                  size="sm"
                  variant={active ? "default" : "outline"}
                  disabled
                  style={{ height: "1.75rem" }}
                >
                  {categoryLabel(category)}
                  <PanelBadge variant="secondary" style={{ marginLeft: "0.25rem", minHeight: "1.25rem" }}>
                    {count}
                  </PanelBadge>
                </PanelButton>
              );
            })}
          </PanelFlex>
        </PanelContainer>

        <PanelScrollArea style={{ height: "calc(100% - 4.5rem)" }}>
          <PanelContainer tabIndex={0} padding="md" style={{ outline: "none" }}>
            <PanelList gap="sm">
            {filtered.map((entry, index) => {
              const active = index === selectedIndex;
              return (
                <PanelListItem
                  key={entry.id}
                  ref={(el) => {
                    itemRefs.current[index] = el;
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  onClick={() => {
                    setFocusArea("list");
                    setSelectedIndex(index);
                    void copyEntry(entry);
                  }}
                  style={
                    active
                      ? {
                          borderColor: "color-mix(in oklab, hsl(var(--primary)) 70%, transparent)",
                          backgroundColor: "color-mix(in oklab, hsl(var(--primary)) 10%, transparent)",
                        }
                      : undefined
                  }
                >
                  <PanelFlex align="center" justify="between" gap="sm" style={{ width: "100%" }}>
                    <PanelText size="xl" style={{ lineHeight: 1 }}>
                      {entry.value}
                    </PanelText>
                    <PanelText
                      size="xs"
                      tone="muted"
                      style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}
                    >
                      {categoryLabel(entry.kind)}
                    </PanelText>
                  </PanelFlex>
                  <PanelText size="sm" weight="medium" truncate style={{ marginTop: "0.25rem" }}>
                    {entry.label}
                  </PanelText>
                  <PanelText size="xs" tone="muted" truncate style={{ marginTop: "0.25rem" }}>
                    {entry.tags.join(", ")}
                  </PanelText>
                </PanelListItem>
              );
            })}

            {filtered.length === 0 && (
              <PanelContainer surface="muted" padding="md">
                <PanelEmpty>
                  <PanelEmptyHeader>
                    <PanelEmptyMedia variant="icon">
                      <Shapes size={20} />
                    </PanelEmptyMedia>
                    <PanelEmptyTitle>No glyphs found</PanelEmptyTitle>
                    <PanelEmptyDescription>
                      Try another term like <code>emoji laugh</code> or <code>else check</code>.
                    </PanelEmptyDescription>
                  </PanelEmptyHeader>
                </PanelEmpty>
              </PanelContainer>
            )}
            </PanelList>
          </PanelContainer>
        </PanelScrollArea>
      </PanelSection>

      <PanelAside
        style={{
          borderLeft: "1px solid color-mix(in oklab, hsl(var(--border)) 40%, transparent)",
          paddingLeft: "0.875rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.875rem",
        }}
      >
        <PanelFlex direction="col" gap="sm">
          <PanelText size="xs" tone="muted" style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Glyph Picker
          </PanelText>
          <PanelText size="xl" weight="semibold">Emoji, Emoticons, Else</PanelText>
          <PanelText size="sm" tone="muted">
            Search and copy frequently used characters from one keyboard-first panel.
          </PanelText>
        </PanelFlex>

        {selected ? (
          <>
            <PanelContainer
              radius="lg"
              padding="md"
              style={{
                border: "1px solid color-mix(in oklab, hsl(var(--border)) 60%, transparent)",
                backgroundColor: "color-mix(in oklab, hsl(var(--background)) 60%, transparent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.75rem",
              }}
            >
              <PanelContainer>
                <PanelText size="xl" style={{ fontSize: "2.25rem", lineHeight: 1 }}>
                  {selected.value}
                </PanelText>
                <PanelText size="sm" weight="medium" style={{ marginTop: "0.5rem" }}>
                  {selected.label}
                </PanelText>
              </PanelContainer>
              <PanelBadge variant="secondary">{categoryLabel(selected.kind)}</PanelBadge>
            </PanelContainer>
            <PanelText size="xs" tone="muted">
              Tags: {selected.tags.join(", ")}
            </PanelText>
          </>
        ) : (
          <PanelContainer surface="muted" padding="md">
            <PanelText size="xs" tone="muted">
              No selection yet. Start typing to find a glyph.
            </PanelText>
          </PanelContainer>
        )}

        <PanelContainer style={{ marginTop: "auto" }}>
          <PanelFlex align="center" justify="between">
            <PanelText size="xs" tone="muted">
              ArrowUp/ArrowDown
            </PanelText>
            <PanelText size="xs" tone="muted" mono>
              Move
            </PanelText>
          </PanelFlex>
          <PanelContainer padding="xs" />
          <PanelFlex align="center" justify="between">
            <PanelText size="xs" tone="muted">
              Enter
            </PanelText>
            <PanelText size="xs" tone="muted" mono>
              Copy
            </PanelText>
          </PanelFlex>
        </PanelContainer>
      </PanelAside>
    </PanelGrid>
  );
}
