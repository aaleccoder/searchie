import * as React from "react";
import { listen } from "@tauri-apps/api/event";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { invokePanelCommand } from "@/lib/tauri-commands";
import { cn } from "@/lib/utils";

type ClipboardKind = "text" | "image" | "files" | "other";

type ClipboardEntry = {
  id: string;
  kind: ClipboardKind;
  preview: string;
  text?: string | null;
  imageBase64?: string | null;
  files: string[];
  formats: string[];
  createdAt: number;
};

type ClipboardPanelProps = {
  commandQuery: string;
};

const FILTERS: Array<{ label: string; value: ClipboardKind | "all" }> = [
  { label: "All", value: "all" },
  { label: "Text", value: "text" },
  { label: "Images", value: "image" },
  { label: "Files", value: "files" },
  { label: "Other", value: "other" },
];

const clipboardCommandScope = {
  id: "clipboard",
  capabilities: ["clipboard.search", "clipboard.clear"] as const,
};

function formatWhen(ts: number) {
  const date = new Date(ts);
  return date.toLocaleString();
}

export function ClipboardPanel({ commandQuery }: ClipboardPanelProps) {
  const [filter, setFilter] = React.useState<ClipboardKind | "all">("all");
  const [search, setSearch] = React.useState("");
  const [items, setItems] = React.useState<ClipboardEntry[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [selectedIndex, setSelectedIndex] = React.useState(0);

  const itemRefs = React.useRef<Array<HTMLElement | null>>([]);

  const loadItems = React.useCallback(async () => {
    try {
      setBusy(true);
      const rows = await invokePanelCommand<ClipboardEntry[]>(
        clipboardCommandScope,
        "search_clipboard_history",
        {
        query: [commandQuery, search].filter(Boolean).join(" "),
        kind: filter,
        limit: 120,
        },
      );
      setItems(rows);
    } catch (error) {
      console.error("[clipboard] failed to load history", error);
      setItems([]);
    } finally {
      setBusy(false);
    }
  }, [commandQuery, search, filter]);

  React.useEffect(() => {
    void loadItems();
  }, [loadItems]);

  React.useEffect(() => {
    let unlisten: undefined | (() => void);
    const setup = async () => {
      unlisten = await listen("searchie://clipboard-updated", () => {
        void loadItems();
      });
    };

    void setup();
    return () => {
      unlisten?.();
    };
  }, [loadItems]);

  React.useEffect(() => {
    if (items.length === 0) {
      setSelectedIndex(0);
      return;
    }

    setSelectedIndex((prev) => {
      if (prev >= items.length) {
        return items.length - 1;
      }
      return prev;
    });
  }, [items]);

  React.useEffect(() => {
    const el = itemRefs.current[selectedIndex];
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const copyEntry = React.useCallback(async (item: ClipboardEntry) => {
    try {
      if (item.kind === "text" && item.text) {
        await navigator.clipboard.writeText(item.text);
      } else if (item.kind === "files" && item.files.length > 0) {
        await navigator.clipboard.writeText(item.files.join("\n"));
      } else if (item.kind === "image" && item.imageBase64 && "ClipboardItem" in window) {
        const res = await fetch(`data:image/png;base64,${item.imageBase64}`);
        const blob = await res.blob();
        await navigator.clipboard.write([
          new ClipboardItem({
            [blob.type || "image/png"]: blob,
          }),
        ]);
      } else {
        const fallback = item.text || item.preview;
        if (!fallback) {
          throw new Error("No copyable content");
        }
        await navigator.clipboard.writeText(fallback);
      }

      toast.success("Copied to clipboard", {
        description: item.preview.slice(0, 80),
      });
    } catch (error) {
      console.error("Failed to copy clipboard entry", error);
      toast.error("Could not copy item", {
        description: "Clipboard access was denied or unsupported.",
      });
    }
  }, []);

  const onListKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (items.length === 0) {
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % items.length);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + items.length) % items.length);
      } else if (event.key === "Enter") {
        event.preventDefault();
        const selected = items[selectedIndex];
        if (selected) {
          void copyEntry(selected);
        }
      }
    },
    [copyEntry, items, selectedIndex],
  );

  return (
    <div className="grid h-full grid-cols-[1.45fr_1fr] gap-2.5 items-stretch">
      <section className="overflow-hidden h-full">
        <div className="p-3 border-b border-border/60 flex items-center gap-2 flex-wrap">
          {FILTERS.map((f) => (
            <Button
              key={f.value}
              type="button"
              size="sm"
              variant={filter === f.value ? "default" : "outline"}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </Button>
          ))}
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter clipboard history..."
            className="ml-auto w-64 h-8"
          />
        </div>

        <ScrollArea className="h-[calc(100%-3.25rem)]">
          <div className="p-3.5 space-y-2.5" tabIndex={0} onKeyDown={onListKeyDown}>
            {items.map((item, idx) => (
              <article
                key={item.id}
                ref={(el) => {
                  itemRefs.current[idx] = el;
                }}
                tabIndex={0}
                role="button"
                aria-selected={selectedIndex === idx}
                onClick={() => {
                  setSelectedIndex(idx);
                  void copyEntry(item);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    setSelectedIndex(idx);
                    void copyEntry(item);
                  }
                }}
                className={cn(
                  "rounded-lg border border-border/60 bg-background/65 p-3 space-y-2",
                  "hover:border-primary/55 transition outline-none",
                  selectedIndex === idx && "border-primary ring-1 ring-primary/45",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="capitalize">{item.kind}</Badge>
                    <span className="text-xs text-muted-foreground">{formatWhen(item.createdAt)}</span>
                  </div>
                  {item.formats.length > 0 && (
                    <span className="text-[11px] text-muted-foreground truncate max-w-68">
                      {item.formats.join(", ")}
                    </span>
                  )}
                </div>

                <p className="text-sm leading-relaxed">{item.preview}</p>

                {item.imageBase64 && (
                  <img
                    src={`data:image/png;base64,${item.imageBase64}`}
                    alt="Clipboard"
                    className="max-h-52 rounded-md border border-border/50 bg-muted object-contain"
                    loading="lazy"
                  />
                )}

                {!!item.files.length && (
                  <div className="space-y-1">
                    {item.files.slice(0, 4).map((path) => (
                      <p key={path} className="text-xs text-muted-foreground break-all">{path}</p>
                    ))}
                  </div>
                )}
              </article>
            ))}

            {!busy && items.length === 0 && (
              <div className="h-32 grid place-items-center text-muted-foreground text-sm">
                Clipboard history is empty.
              </div>
            )}
          </div>
        </ScrollArea>
      </section>

      <aside className="rounded-xl border border-border/70 bg-card/92 shadow-lg p-3.5 flex flex-col gap-3.5">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Clipboard App</p>
          <h3 className="text-xl font-semibold leading-tight">Clipboard</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Searchie now keeps an internal clipboard registry for text, images, and file copies.
          </p>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Tracked items</span>
            <span className="text-right">{items.length}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Active filter</span>
            <span className="text-right capitalize">{filter}</span>
          </div>
        </div>

        <div className="mt-auto space-y-2 text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>Command mode</span>
            <span className="font-mono">cl</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Refresh</span>
            <span className="font-mono">Live</span>
          </div>
        </div>
      </aside>
    </div>
  );
}
