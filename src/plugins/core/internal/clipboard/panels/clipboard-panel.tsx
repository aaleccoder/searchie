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
  Badge as PanelBadge,
  Grid as PanelGrid,
  List as PanelList,
  ListItem as PanelListItem,
  MetaGrid as PanelMetaGrid,
  PanelAside,
  PanelCode,
  PanelContainer,
  PanelFlex,
  PanelSection,
  PanelText,
  ScrollArea as PanelScrollArea,
  Select as PanelSelect,
  SelectContent as PanelSelectContent,
  SelectItem as PanelSelectItem,
  SelectTrigger as PanelSelectTrigger,
  SelectValue as PanelSelectValue,
  createPluginBackendSdk,
  usePanelArrowDownBridge,
  usePanelFooter,
  usePanelFooterControlsRef,
} from "@/plugins/sdk";
import type { PanelFooterConfig } from "@/lib/panel-contract";
import { extractFirstColorToken } from "@/lib/utilities/color-preview";
import type { PanelCommandScope } from "@/lib/tauri-commands";

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
  pluginId: "core.clipboard",
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
  const backend = React.useMemo(() => createPluginBackendSdk(clipboardCommandScope), []);
  const [filter, setFilter] = React.useState<ClipboardKind | "all">("all");
  const [items, setItems] = React.useState<ClipboardEntry[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [selectedIndex, setSelectedIndex] = React.useState(0);

  const itemRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
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
      const rows = await backend.clipboard.searchHistory<ClipboardEntry[]>(commandQuery, filter, 120);
      setItems(rows);
    } catch (error) {
      console.error("[clipboard] failed to load history", error);
      setItems([]);
    } finally {
      setBusy(false);
    }
  }, [backend.clipboard, commandQuery, filter]);

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
      await backend.clipboard.togglePin(selectedItem.id);
      toast.success(selectedItem.pinned ? "Entry unpinned" : "Entry pinned");
      await loadItems();
    } catch (error) {
      console.error("Failed to toggle pin", error);
      toast.error("Could not pin entry", {
        description: "Please try again.",
      });
    }
  }, [backend.clipboard, loadItems, selectedItem]);

  const deleteSelected = React.useCallback(async () => {
    if (!selectedItem) {
      return;
    }

    try {
      await backend.clipboard.deleteEntry(selectedItem.id);
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
  }, [backend.clipboard, loadItems, selectedItem]);

  const clearAll = React.useCallback(async () => {
    try {
      await backend.clipboard.clearHistory();
      toast.success("Clipboard history cleared");
      await loadItems();
    } catch (error) {
      console.error("Failed to clear clipboard history", error);
      toast.error("Could not clear history", {
        description: "Please try again.",
      });
    }
  }, [backend.clipboard, loadItems]);

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
    <PanelGrid columns="two-pane" gap="sm" style={{ height: "100%" }}>
      <PanelSection
        style={{
          height: "100%",
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <PanelContainer
          padding="md"
          style={{
            flexShrink: 0,
            borderBottom: "1px solid color-mix(in oklab, hsl(var(--border)) 60%, transparent)",
          }}
        >
          <PanelFlex align="center" gap="sm">
            <PanelSelect
              value={filter}
              onValueChange={(value: string | null) => {
                setFilter((value ?? "all") as ClipboardKind | "all");
              }}
            >
              <PanelSelectTrigger style={{ width: "9rem" }}>
                <PanelSelectValue />
              </PanelSelectTrigger>
              <PanelSelectContent align="start" style={{ backdropFilter: "blur(12px)" }}>
                {FILTERS.map((f) => (
                  <PanelSelectItem key={f.value} value={f.value}>
                    {f.label}
                  </PanelSelectItem>
                ))}
              </PanelSelectContent>
            </PanelSelect>
            <PanelText
              size="xs"
              tone="muted"
              truncate
              style={{ marginLeft: "auto", maxWidth: "16rem" }}
              title={commandQuery ? `Query: ${commandQuery}` : "Type in top search to filter"}
            >
              {commandQuery ? `Query: ${commandQuery}` : "Type in top search to filter"}
            </PanelText>
          </PanelFlex>
        </PanelContainer>

        <PanelScrollArea style={{ minHeight: 0, flex: 1 }}>
          <PanelContainer ref={listContainerRef} tabIndex={0} padding="md" style={{ outline: "none" }}>
            <PanelList gap="md">
              {items.map((item, idx) => (
                <PanelListItem
                  key={item.id}
                  active={selectedIndex === idx}
                  ref={(el) => {
                    itemRefs.current[idx] = el;
                  }}
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
                >
                  <PanelFlex align="center" justify="between" gap="sm" style={{ width: "100%" }}>
                    <PanelFlex align="center" gap="sm" style={{ minWidth: 0 }}>
                      <PanelBadge
                        variant="ghost"
                        aria-label={`${item.kind} clipboard item`}
                        title={item.kind}
                        style={{ width: "1.5rem", height: "1.5rem", padding: 0 }}
                      >
                        <HugeiconsIcon icon={KIND_ICON_MAP[item.kind]} strokeWidth={2} aria-hidden="true" size={14} />
                      </PanelBadge>
                      {item.imageBase64 && (
                        <img
                          src={`data:image/png;base64,${item.imageBase64}`}
                          alt="Clipboard thumbnail"
                          loading="lazy"
                          style={{
                            width: "1.75rem",
                            height: "1.75rem",
                            borderRadius: "0.25rem",
                            border: "1px solid color-mix(in oklab, hsl(var(--border)) 50%, transparent)",
                            backgroundColor: "hsl(var(--muted))",
                            objectFit: "cover",
                          }}
                        />
                      )}
                      <PanelText size="sm" truncate style={{ width: "18rem", lineHeight: 1.4 }} title={item.preview}>
                        {item.preview || "(empty)"}
                      </PanelText>
                      {colorPreviewById.get(item.id) && (
                        <PanelFlex align="center" gap="xs">
                          <PanelContainer
                            radius="sm"
                            style={{
                              width: "0.75rem",
                              height: "0.75rem",
                              border: "1px solid color-mix(in oklab, hsl(var(--border)) 70%, transparent)",
                              backgroundColor: colorPreviewById.get(item.id),
                            }}
                            aria-hidden="true"
                          />
                          <PanelText size="xs" tone="muted" mono truncate style={{ maxWidth: "7.5rem" }}>
                            {colorPreviewById.get(item.id)}
                          </PanelText>
                        </PanelFlex>
                      )}
                      {item.pinned && <PanelBadge variant="outline">Pinned</PanelBadge>}
                    </PanelFlex>
                  </PanelFlex>
                </PanelListItem>
              ))}

              {!busy && items.length === 0 && (
                <PanelContainer style={{ display: "grid", height: "8rem", placeItems: "center" }}>
                  <PanelText size="sm" tone="muted">
                    Clipboard history is empty.
                  </PanelText>
                </PanelContainer>
              )}
            </PanelList>
          </PanelContainer>
        </PanelScrollArea>
      </PanelSection>

      <PanelAside
        style={{
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          padding: "0.875rem",
        }}
      >
        {!selectedItem && (
          <PanelContainer style={{ display: "grid", height: "100%", placeItems: "center" }}>
            <PanelText size="sm" tone="muted">
              Select a clipboard item to see details.
            </PanelText>
          </PanelContainer>
        )}

        {selectedItem && (
          <>
            <PanelContainer>
              <PanelFlex align="center" gap="sm">
                <PanelBadge variant="ghost" title={selectedItem.kind} style={{ width: "1.5rem", height: "1.5rem", padding: 0 }}>
                  <HugeiconsIcon icon={KIND_ICON_MAP[selectedItem.kind]} strokeWidth={2} aria-hidden="true" size={14} />
                </PanelBadge>
                <PanelText size="lg" weight="semibold" style={{ textTransform: "capitalize", lineHeight: 1.2 }}>
                  {selectedItem.kind} item
                </PanelText>
                {selectedItem.pinned && <PanelBadge variant="outline">Pinned</PanelBadge>}
              </PanelFlex>
            </PanelContainer>

            <PanelScrollArea style={{ minHeight: 0, flex: 1 }}>
              <PanelFlex direction="col" gap="md">
                {selectedItem.kind === "text" && (
                  <pre
                    style={{
                      wordBreak: "break-word",
                      maxHeight: "10rem",
                      whiteSpace: "pre-wrap",
                      fontSize: "0.875rem",
                      lineHeight: 1.5,
                      fontFamily: "inherit",
                      maxWidth: "20rem",
                      margin: 0,
                    }}
                  >
                    {selectedItemText || "(empty text)"}
                  </pre>
                )}

                {selectedItemColorPreview && (
                  <PanelContainer
                    padding="md"
                    radius="md"
                    style={{
                      border: "1px solid color-mix(in oklab, hsl(var(--border)) 60%, transparent)",
                      backgroundColor: "color-mix(in oklab, hsl(var(--background)) 60%, transparent)",
                    }}
                  >
                    <PanelText size="xs" tone="muted" style={{ marginBottom: "0.5rem" }}>
                      Detected color
                    </PanelText>
                    <PanelFlex align="center" gap="md">
                      <PanelContainer
                        radius="md"
                        style={{
                          width: "2rem",
                          height: "2rem",
                          border: "1px solid color-mix(in oklab, hsl(var(--border)) 80%, transparent)",
                          backgroundColor: selectedItemColorPreview,
                        }}
                        aria-hidden="true"
                      />
                      <PanelCode>{selectedItemColorPreview}</PanelCode>
                    </PanelFlex>
                  </PanelContainer>
                )}

                {selectedItem.imageBase64 && (
                  <img
                    src={`data:image/png;base64,${selectedItem.imageBase64}`}
                    alt="Clipboard preview"
                    loading="lazy"
                    style={{
                      maxHeight: "26rem",
                      width: "100%",
                      borderRadius: "0.375rem",
                      border: "1px solid color-mix(in oklab, hsl(var(--border)) 50%, transparent)",
                      backgroundColor: "hsl(var(--muted))",
                      objectFit: "contain",
                    }}
                  />
                )}

                {selectedItem.files.length > 0 && (
                  <PanelFlex direction="col" gap="xs">
                    {selectedItem.files.map((path) => (
                      <PanelText key={path} size="xs" tone="muted" style={{ overflowWrap: "anywhere" }}>
                        {path}
                      </PanelText>
                    ))}
                  </PanelFlex>
                )}

                {selectedItem.kind !== "text" && !selectedItem.imageBase64 && (
                  <PanelText size="sm" tone="muted" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                    {selectedItemText || "No preview available."}
                  </PanelText>
                )}
              </PanelFlex>
            </PanelScrollArea>

            <PanelMetaGrid>
              <PanelText size="xs" tone="muted">ID</PanelText>
              <PanelText size="xs" truncate style={{ textAlign: "right" }} title={selectedItem.id}>
                {selectedItem.id}
              </PanelText>
              <PanelText size="xs" tone="muted">Date</PanelText>
              <PanelText size="xs" truncate style={{ textAlign: "right" }} title={formatWhen(selectedItem.createdAt)}>
                {formatWhen(selectedItem.createdAt)}
              </PanelText>
              <PanelText size="xs" tone="muted">Formats</PanelText>
              <PanelText
                size="xs"
                truncate
                style={{ textAlign: "right" }}
                title={selectedItem.formats.join(", ")}
              >
                {selectedItem.formats.length > 0 ? selectedItem.formats.join(", ") : "-"}
              </PanelText>
              <PanelText size="xs" tone="muted">Files</PanelText>
              <PanelText size="xs" style={{ textAlign: "right" }}>{selectedItem.files.length}</PanelText>
            </PanelMetaGrid>

            <PanelFlex align="center" justify="between">
              <PanelText size="xs" tone="muted">Copy</PanelText>
              <PanelText size="xs" tone="muted" mono>Enter</PanelText>
            </PanelFlex>
          </>
        )}
      </PanelAside>
    </PanelGrid>
  );
}
