import * as React from "react";
import { useHotkey } from "@tanstack/react-hotkeys";
import { Copy, Shapes } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { ScrollArea } from "@/components/ui/scroll-area";
import { registerGlyphPickerInputController } from "@/components/panels/utilities/glyph-picker-keybindings";
import {
  filterGlyphEntries,
  GLYPH_ENTRIES,
  loadEmojiEntriesFromUnicodeData,
  parseGlyphPickerQuery,
  type GlyphEntry,
  type GlyphPickerQuery,
} from "@/lib/utilities/glyph-picker-engine";
import { cn } from "@/lib/utils";

type GlyphPickerUtilityPanelProps = {
  commandQuery: string;
  registerInputArrowDownHandler?: ((handler: (() => boolean | void) | null) => void) | undefined;
  registerInputEnterHandler?: ((handler: (() => boolean | void) | null) => void) | undefined;
  focusLauncherInput?: (() => void) | undefined;
};

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
  focusLauncherInput,
}: GlyphPickerUtilityPanelProps) {
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [focusArea, setFocusArea] = React.useState<"list" | "actions">("list");
  const [selectedActionIndex, setSelectedActionIndex] = React.useState(0);
  const [loadedEmojiEntries, setLoadedEmojiEntries] = React.useState<GlyphEntry[]>([]);
  const itemRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const actionRefs = React.useRef<Array<HTMLButtonElement | null>>([]);

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

  const parsedQuery = React.useMemo(() => parseGlyphPickerQuery(commandQuery), [commandQuery]);
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
    itemRefs.current[selectedIndex]?.scrollIntoView({ block: "nearest" });
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

  React.useEffect(() => {
    if (!registerInputArrowDownHandler) {
      return;
    }

    registerInputArrowDownHandler(() => moveSelection(1));
    return () => {
      registerInputArrowDownHandler(null);
    };
  }, [moveSelection, registerInputArrowDownHandler]);

  React.useEffect(() => {
    if (!registerInputEnterHandler) {
      return;
    }

    registerInputEnterHandler(activateCurrentAction);
    return () => {
      registerInputEnterHandler(null);
    };
  }, [activateCurrentAction, registerInputEnterHandler]);

  const onListKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        void moveSelection(1);
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        if (selectedIndex === 0) {
          focusLauncherInput?.();
          return;
        }
        void moveSelection(-1);
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        void focusActions();
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        void focusList();
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        void activateCurrentAction();
      }
    },
    [
      activateCurrentAction,
      filtered.length,
      focusActions,
      focusLauncherInput,
      focusList,
      moveSelection,
      selectedIndex,
    ],
  );

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

  return (
    <div className="grid h-full grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] gap-2.5 items-stretch">
      <section className="min-w-0 overflow-hidden h-full">
        <div className="border-b border-border/40 p-3 space-y-2">
          <p className="text-xs text-muted-foreground">
            Use launcher input: <code>emoji smile</code>, <code>emoticon shrug</code>, <code>else arrow</code>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORY_ORDER.map((category) => {
              const active = parsedQuery.category === category;
              const count = counts[category];
              return (
                <Button
                  key={category}
                  type="button"
                  size="sm"
                  variant={active ? "default" : "outline"}
                  disabled
                  className="h-7"
                >
                  {categoryLabel(category)}
                  <Badge variant="secondary" className="ml-1 h-5">
                    {count}
                  </Badge>
                </Button>
              );
            })}
          </div>
        </div>

        <ScrollArea className="h-[calc(100%-4.5rem)]">
          <div tabIndex={0} onKeyDown={onListKeyDown} className="p-3.5 space-y-2 outline-none">
            {filtered.map((entry, index) => {
              const active = index === selectedIndex;
              return (
                <button
                  key={entry.id}
                  type="button"
                  ref={(el) => {
                    itemRefs.current[index] = el;
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  onClick={() => {
                    setFocusArea("list");
                    setSelectedIndex(index);
                    void copyEntry(entry);
                  }}
                  className={cn(
                    "w-full min-w-0 rounded-lg border px-3 py-2 text-left transition",
                    active
                      ? "border-primary/70 bg-primary/10"
                      : "border-border/55 hover:border-primary/45 hover:bg-accent/40",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-2xl leading-none">{entry.value}</p>
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      {categoryLabel(entry.kind)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-medium truncate">{entry.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground truncate">{entry.tags.join(", ")}</p>
                </button>
              );
            })}

            {filtered.length === 0 && (
              <Empty className="border-border/60">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Shapes className="size-5" />
                  </EmptyMedia>
                  <EmptyTitle>No glyphs found</EmptyTitle>
                  <EmptyDescription>
                    Try another term like <code>emoji laugh</code> or <code>else check</code>.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </div>
        </ScrollArea>
      </section>

      <aside className="min-w-0 border-l border-border/40 pl-3.5 flex flex-col gap-3.5">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Glyph Picker</p>
          <h3 className="text-xl font-semibold leading-tight">Emoji, Emoticons, Else</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Search and copy frequently used characters from one keyboard-first panel.
          </p>
        </div>

        {selected ? (
          <>
            <div className="rounded-lg border border-border/60 bg-background/60 p-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-4xl leading-none">{selected.value}</p>
                <p className="mt-2 text-sm font-medium">{selected.label}</p>
              </div>
              <Badge variant="secondary">{categoryLabel(selected.kind)}</Badge>
            </div>
            <div className="text-xs text-muted-foreground">Tags: {selected.tags.join(", ")}</div>
            <Button
              type="button"
              ref={(el) => {
                actionRefs.current[0] = el;
              }}
              variant={focusArea === "actions" && selectedActionIndex === 0 ? "default" : "secondary"}
              className="w-full"
              onMouseEnter={() => {
                setFocusArea("actions");
                setSelectedActionIndex(0);
              }}
              onClick={() => void copyEntry(selected)}
            >
              <Copy className="size-4" />
              Copy Selected
            </Button>
            <Button
              type="button"
              ref={(el) => {
                actionRefs.current[1] = el;
              }}
              variant={focusArea === "actions" && selectedActionIndex === 1 ? "default" : "outline"}
              className="w-full"
              onMouseEnter={() => {
                setFocusArea("actions");
                setSelectedActionIndex(1);
              }}
              onClick={() => {
                focusLauncherInput?.();
              }}
            >
              Back To Input
            </Button>
          </>
        ) : (
          <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
            No selection yet. Start typing to find a glyph.
          </div>
        )}

        <div className="mt-auto space-y-2 text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>ArrowUp/ArrowDown</span>
            <span className="font-mono">Move</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Enter</span>
            <span className="font-mono">Copy</span>
          </div>
        </div>
      </aside>
    </div>
  );
}
