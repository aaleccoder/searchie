import * as React from "react";
import { ClipboardList, Copy, ExternalLink, Pin, PinOff, Trash2, Trash } from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useHotkey } from "@tanstack/react-hotkeys";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  File01Icon,
  Image01Icon,
  MoreHorizontalCircle01Icon,
  TextIcon,
} from "@hugeicons/core-free-icons";
import {
  PanelBadge,
  PanelScrollArea,
  PanelSelect,
  PanelSelectContent,
  PanelSelectItem,
  PanelSelectTrigger,
  PanelSelectValue,
  usePanelArrowDownBridge,
  usePanelFooter,
  usePanelFooterControlsRef,
} from "@/components/panels/framework";
import type { PanelFooterConfig } from "@/lib/panel-contract";
import { extractFirstColorToken } from "@/lib/utilities/color-preview";
import { invokePanelCommand, type PanelCommandScope } from "@/lib/tauri-commands";
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
  pinned?: boolean;
};

type ClipboardPanelProps = {
  commandQuery: string;
  registerInputArrowDownHandler?: ((handler: (() => boolean | void) | null) => void) | undefined;
  registerPanelFooter?: ((footer: PanelFooterConfig | null) => void) | undefined;
  focusLauncherInput?: (() => void) | undefined;
  clearLauncherInput?: (() => void) | undefined;
};

const FILTERS: Array<{ label: string; value: ClipboardKind | "all" }> = [
  { label: "All", value: "all" },
  { label: "Text", value: "text" },
  { label: "Images", value: "image" },
  { label: "Files", value: "files" },
  { label: "Other", value: "other" },
];

const clipboardCommandScope: PanelCommandScope = {
  id: "clipboard",
  capabilities: ["clipboard.search", "clipboard.clear", "clipboard.pin", "clipboard.delete"],
};

const URL_PATTERN = /https?:\/\/[^\s<>")\]]+/gi;

const KIND_ICON_MAP: Record<ClipboardKind, typeof TextIcon> = {
  text: TextIcon,
  image: Image01Icon,
  files: File01Icon,
  other: MoreHorizontalCircle01Icon,
};

function formatWhen(ts: number) {
  const date = new Date(ts);
  return date.toLocaleString();
}

function collectUrls(input: string): string[] {
  const matches = input.match(URL_PATTERN) ?? [];
  const seen = new Set<string>();
  const urls: string[] = [];

  for (const raw of matches) {
    const normalized = raw.replace(/[.,;:!?]+$/, "");
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    urls.push(normalized);
  }

  return urls;
}

export function ClipboardPanel({
  commandQuery,
  registerInputArrowDownHandler,
  registerPanelFooter,
  focusLauncherInput,
  clearLauncherInput,
}: ClipboardPanelProps) {
  const [filter, setFilter] = React.useState<ClipboardKind | "all">("all");
  const [items, setItems] = React.useState<ClipboardEntry[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [selectedIndex, setSelectedIndex] = React.useState(0);

  const itemRefs = React.useRef<Array<HTMLElement | null>>([]);
  const listContainerRef = React.useRef<HTMLDivElement | null>(null);
  const { controlsRef: footerControlsRef, registerFooterControls } = usePanelFooterControlsRef();

  const onArrowDownFromLauncher = React.useCallback(() => {
    if (!listContainerRef.current) {
      return false;
    }
    listContainerRef.current.focus();
    return true;
  }, []);

  usePanelArrowDownBridge(registerInputArrowDownHandler, onArrowDownFromLauncher);

  const loadItems = React.useCallback(async () => {
    try {
      setBusy(true);
      const rows = await invokePanelCommand<ClipboardEntry[]>(
        clipboardCommandScope,
        "search_clipboard_history",
        {
          query: commandQuery,
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
  }, [commandQuery, filter]);

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
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  const colorPreviewById = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const item of items) {
      if (item.kind !== "text") {
        continue;
      }

      const sourceText = [item.text, item.preview].filter(Boolean).join("\n");
      const color = extractFirstColorToken(sourceText);
      if (color) {
        map.set(item.id, color);
      }
    }
    return map;
  }, [items]);

  const selectedItem = items[selectedIndex] ?? null;
  const selectedItemText = selectedItem?.text?.trim() || selectedItem?.preview || "";
  const selectedItemColorPreview = selectedItem ? colorPreviewById.get(selectedItem.id) ?? null : null;
  const selectedItemLinksCount = React.useMemo(() => {
    if (!selectedItem) {
      return 0;
    }

    const sourceText = [selectedItem.text, selectedItem.preview].filter(Boolean).join("\n");
    return collectUrls(sourceText).length;
  }, [selectedItem]);

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

  const cycleFilter = React.useCallback(() => {
    setFilter((prev) => {
      const index = FILTERS.findIndex((f) => f.value === prev);
      const next = FILTERS[(index + 1) % FILTERS.length];
      return next.value;
    });
  }, []);

  const openSelectedLinks = React.useCallback(async () => {
    if (!selectedItem) {
      return;
    }

    const sourceText = [selectedItem.text, selectedItem.preview].filter(Boolean).join("\n");
    const urls = collectUrls(sourceText).slice(0, 8);

    if (urls.length === 0) {
      toast.error("No links found", {
        description: "The selected clipboard entry does not contain any URLs.",
      });
      return;
    }

    try {
      for (const url of urls) {
        await openUrl(url);
      }
      toast.success("Opened links", {
        description: urls.length === 1 ? urls[0] : `${urls.length} links opened in browser`,
      });
    } catch (error) {
      console.error("Failed to open links", error);
      toast.error("Could not open links", {
        description: "Your system blocked opening one or more URLs.",
      });
    }
  }, [selectedItem]);

  const togglePinSelected = React.useCallback(async () => {
    if (!selectedItem) {
      return;
    }

    try {
      await invokePanelCommand<void>(clipboardCommandScope, "toggle_clipboard_pin", {
        id: selectedItem.id,
      });
      toast.success(selectedItem.pinned ? "Entry unpinned" : "Entry pinned");
      await loadItems();
    } catch (error) {
      console.error("Failed to toggle pin", error);
      toast.error("Could not pin entry", {
        description: "Please try again.",
      });
    }
  }, [loadItems, selectedItem]);

  const deleteSelected = React.useCallback(async () => {
    if (!selectedItem) {
      return;
    }

    try {
      await invokePanelCommand<void>(clipboardCommandScope, "delete_clipboard_entry", {
        id: selectedItem.id,
      });
      toast.success("Entry removed", {
        description: selectedItem.preview.slice(0, 80),
      });
      await loadItems();
    } catch (error) {
      console.error("Failed to delete entry", error);
      toast.error("Could not remove entry", {
        description: "Please try again.",
      });
    }
  }, [loadItems, selectedItem]);

  const clearAll = React.useCallback(async () => {
    try {
      await invokePanelCommand<void>(clipboardCommandScope, "clear_clipboard_history", {});
      toast.success("Clipboard history cleared");
      await loadItems();
    } catch (error) {
      console.error("Failed to clear clipboard history", error);
      toast.error("Could not clear history", {
        description: "Please try again.",
      });
    }
  }, [loadItems]);

  const footerConfig = React.useMemo<PanelFooterConfig | null>(() => {
    if (!selectedItem) {
      return null;
    }

    return {
      panel: {
        title: "Clipboard",
        icon: ClipboardList,
      },
      registerControls: registerFooterControls,
      primaryAction: {
        id: "copy",
        label: "Copy",
        icon: Copy,
        onSelect: () => {
          void copyEntry(selectedItem);
        },
        shortcutHint: "Enter",
      },
      extraActions: [
        {
          id: "open-links",
          label: "Open Links",
          icon: ExternalLink,
          onSelect: () => {
            void openSelectedLinks();
          },
          disabled: selectedItemLinksCount === 0,
          shortcutHint: "Mod+O",
        },
        {
          id: "toggle-pin",
          label: selectedItem.pinned ? "Unpin Item" : "Pin Item",
          icon: selectedItem.pinned ? PinOff : Pin,
          onSelect: () => {
            void togglePinSelected();
          },
          shortcutHint: "Mod+Shift+P",
        },
        {
          id: "delete-item",
          label: "Delete Item",
          icon: Trash2,
          onSelect: () => {
            void deleteSelected();
          },
          destructive: true,
          shortcutHint: "Ctrl+X",
        },
        {
          id: "clear-all",
          label: "Clear History",
          icon: Trash,
          onSelect: () => {
            void clearAll();
          },
          disabled: items.length === 0,
          destructive: true,
          shortcutHint: "Ctrl+Shift+X",
        },
      ],
    };
  }, [clearAll, copyEntry, deleteSelected, items.length, openSelectedLinks, registerFooterControls, selectedItem, selectedItemLinksCount, togglePinSelected]);

  usePanelFooter(registerPanelFooter, footerConfig);

  useHotkey(
    "Alt+K",
    () => {
      footerControlsRef.current?.openExtraActions();
    },
    { enabled: !!selectedItem && (footerConfig?.extraActions?.length ?? 0) > 0, preventDefault: true },
  );

  useHotkey(
    "ArrowDown",
    () => {
      if (items.length === 0) {
        return;
      }
      setSelectedIndex((prev) => (prev + 1) % items.length);
    },
    { enabled: items.length > 0, preventDefault: true },
  );

  useHotkey(
    "ArrowUp",
    () => {
      if (items.length === 0) {
        return;
      }

      setSelectedIndex((prev) => {
        if (prev === 0) {
          focusLauncherInput?.();
          return 0;
        }
        return prev - 1;
      });
    },
    { enabled: items.length > 0, preventDefault: true },
  );

  useHotkey(
    "Escape",
    () => {
      focusLauncherInput?.();
    },
    { preventDefault: true },
  );

  useHotkey(
    "Enter",
    () => {
      if (selectedItem) {
        void copyEntry(selectedItem);
      }
    },
    { enabled: !!selectedItem, preventDefault: true },
  );

  useHotkey(
    "Mod+O",
    () => {
      if (!footerControlsRef.current?.runExtraActionById("open-links")) {
        void openSelectedLinks();
      }
    },
    { enabled: !!selectedItem, preventDefault: true },
  );

  useHotkey(
    "Mod+Shift+P",
    () => {
      if (!footerControlsRef.current?.runExtraActionById("toggle-pin")) {
        void togglePinSelected();
      }
    },
    { enabled: !!selectedItem, preventDefault: true },
  );

  useHotkey(
    "Mod+P",
    () => {
      cycleFilter();
    },
    { preventDefault: true },
  );

  useHotkey(
    "Control+X",
    () => {
      if (!footerControlsRef.current?.runExtraActionById("delete-item")) {
        void deleteSelected();
      }
    },
    { enabled: !!selectedItem, preventDefault: true },
  );

  useHotkey(
    "Control+Shift+X",
    () => {
      if (!footerControlsRef.current?.runExtraActionById("clear-all")) {
        void clearAll();
      }
    },
    { enabled: items.length > 0, preventDefault: true },
  );

  return (
    <div className="grid h-full grid-cols-[1.45fr_1fr] gap-2.5 items-stretch">
      <section className="flex h-full min-h-0 flex-col overflow-hidden outline-none border-none">
        <div className="flex shrink-0 items-center gap-2 border-b border-border/60 p-3">
          <PanelSelect
            value={filter}
            onValueChange={(value: string | null) => {
              setFilter((value ?? "all") as ClipboardKind | "all");
            }}
          >
            <PanelSelectTrigger className="w-36">
              <PanelSelectValue />
            </PanelSelectTrigger>
            <PanelSelectContent align="start" className="backdrop-blur-md">
              {FILTERS.map((f) => (
                <PanelSelectItem key={f.value} value={f.value}>
                  {f.label}
                </PanelSelectItem>
              ))}
            </PanelSelectContent>
          </PanelSelect>
          <span className="ml-auto max-w-64 truncate text-xs text-muted-foreground">
            {commandQuery ? `Query: ${commandQuery}` : "Type in top search to filter"}
          </span>
        </div>

        <PanelScrollArea className="min-h-0 flex-1">
          <div
            ref={listContainerRef}
            className="space-y-2.5 p-3.5 outline-none focus-visible:outline-none"
            tabIndex={0}
          >
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
                  clearLauncherInput?.();
                  void copyEntry(item);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    setSelectedIndex(idx);
                    clearLauncherInput?.();
                    void copyEntry(item);
                  }
                }}
                className={cn(
                  "p-3",
                  "hover:bg-card-foreground/10 hover:backdrop-blur-sm hover:rounded-md transition outline-none",
                  selectedIndex === idx && "bg-card-foreground/10 backdrop-blur-sm rounded-md",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <PanelBadge
                      variant="ghost"
                      className="size-6 p-0 [&_svg]:size-3.5"
                      aria-label={`${item.kind} clipboard item`}
                      title={item.kind}
                    >
                      <HugeiconsIcon icon={KIND_ICON_MAP[item.kind]} strokeWidth={2} aria-hidden="true" />
                    </PanelBadge>
                    {item.imageBase64 && (
                      <img
                        src={`data:image/png;base64,${item.imageBase64}`}
                        alt="Clipboard thumbnail"
                        className="size-7 rounded border border-border/50 bg-muted object-cover"
                        loading="lazy"
                      />
                    )}
                    <p className="w-72 truncate text-sm leading-relaxed" title={item.preview}>
                      {item.preview || "(empty)"}
                    </p>
                    {colorPreviewById.get(item.id) && (
                      <div className="flex items-center gap-1.5">
                        <span
                          className="size-3 rounded border border-border/70"
                          style={{ backgroundColor: colorPreviewById.get(item.id) }}
                          aria-hidden="true"
                        />
                        <span className="max-w-30 truncate font-mono text-[11px] text-muted-foreground">
                          {colorPreviewById.get(item.id)}
                        </span>
                      </div>
                    )}
                    {item.pinned && <PanelBadge variant="outline">Pinned</PanelBadge>}
                  </div>
                </div>
              </article>
            ))}

            {!busy && items.length === 0 && (
              <div className="grid h-32 place-items-center text-sm text-muted-foreground">
                Clipboard history is empty.
              </div>
            )}
          </div>
        </PanelScrollArea>
      </section>

      <aside className="flex min-h-0 flex-col gap-3 p-3.5">
        {!selectedItem && (
          <div className="grid h-full place-items-center text-sm text-muted-foreground">
            Select a clipboard item to see details.
          </div>
        )}

        {selectedItem && (
          <>
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                <PanelBadge variant="ghost" className="size-6 p-0 [&_svg]:size-3.5" title={selectedItem.kind}>
                  <HugeiconsIcon icon={KIND_ICON_MAP[selectedItem.kind]} strokeWidth={2} aria-hidden="true" />
                </PanelBadge>
                <h3 className="text-lg font-semibold capitalize leading-tight">{selectedItem.kind} item</h3>
                {selectedItem.pinned && <PanelBadge variant="outline">Pinned</PanelBadge>}
              </div>
            </div>

            <PanelScrollArea className="min-h-0 flex-1">
              <div className="space-y-3">
                {selectedItem.kind === "text" && (
                  <pre
                    className="wrap-break-word max-h-40 whitespace-pre-wrap text-sm leading-relaxed font-sans max-w-80"
                  >
                    {selectedItemText || "(empty text)"}
                  </pre>
                )}

                {selectedItemColorPreview && (
                  <div className="rounded-md border border-border/60 bg-background/60 p-3">
                    <p className="mb-2 text-xs text-muted-foreground">Detected color</p>
                    <div className="flex items-center gap-3">
                      <span
                        className="size-8 rounded border border-border/80"
                        style={{ backgroundColor: selectedItemColorPreview }}
                        aria-hidden="true"
                      />
                      <code className="text-xs font-mono text-foreground">{selectedItemColorPreview}</code>
                    </div>
                  </div>
                )}

                {selectedItem.imageBase64 && (
                  <img
                    src={`data:image/png;base64,${selectedItem.imageBase64}`}
                    alt="Clipboard preview"
                    className="max-h-105 w-full rounded-md border border-border/50 bg-muted object-contain"
                    loading="lazy"
                  />
                )}

                {selectedItem.files.length > 0 && (
                  <div className="space-y-1.5">
                    {selectedItem.files.map((path) => (
                      <p key={path} className="break-all text-xs text-muted-foreground">
                        {path}
                      </p>
                    ))}
                  </div>
                )}

                {selectedItem.kind !== "text" && !selectedItem.imageBase64 && (
                  <p className="wrap-break-word whitespace-pre-wrap text-sm text-muted-foreground">
                    {selectedItemText || "No preview available."}
                  </p>
                )}
              </div>
            </PanelScrollArea>

            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <span className="text-muted-foreground">ID</span>
              <span className="truncate text-right" title={selectedItem.id}>
                {selectedItem.id}
              </span>
              <span className="text-muted-foreground">Date</span>
              <span className="truncate text-right" title={formatWhen(selectedItem.createdAt)}>
                {formatWhen(selectedItem.createdAt)}
              </span>
              <span className="text-muted-foreground">Formats</span>
              <span className="truncate text-right" title={selectedItem.formats.join(", ")}>
                {selectedItem.formats.length > 0 ? selectedItem.formats.join(", ") : "-"}
              </span>
              <span className="text-muted-foreground">Files</span>
              <span className="text-right">{selectedItem.files.length}</span>
            </div>

            <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
              <span>Copy</span>
              <span className="font-mono">Enter</span>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
