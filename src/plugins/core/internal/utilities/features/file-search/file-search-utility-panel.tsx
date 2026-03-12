import * as React from "react";
import { FolderSearch, Loader2, FolderOpen, FileSearch, ExternalLink } from "lucide-react";
import { useHotkey } from "@tanstack/react-hotkeys";
import {
  Empty as PanelEmpty,
  EmptyDescription as PanelEmptyDescription,
  EmptyHeader as PanelEmptyHeader,
  EmptyMedia as PanelEmptyMedia,
  EmptyTitle as PanelEmptyTitle,
  Grid as PanelGrid,
  List as PanelList,
  MetaGrid as PanelMetaGrid,
  ListItem as PanelListItem,
  ScrollArea as PanelScrollArea,
  PanelAside,
  PanelCode,
  PanelContainer,
  PanelFigureImage,
  PanelFlex,
  PanelSection,
  PanelText,
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
import { buildSearchRequest, rankFileSearchResults } from "@/lib/utilities/file-search-engine";
import { registerFileSearchInputController } from "./file-search-keybindings";

type FileSearchUtilityPanelProps = {
  commandQuery: string;
  registerInputArrowDownHandler?: ((handler: (() => boolean | void) | null) => void) | undefined;
  registerInputEnterHandler?: ((handler: (() => boolean | void) | null) => void) | undefined;
  registerPanelFooter?: ((footer: PanelFooterConfig | null) => void) | undefined;
  focusLauncherInput?: (() => void) | undefined;
};

type FileSearchResult = {
  path: string;
  name: string;
  extension: string | null;
  indexedAt: number;
};

const fileSearchCommandScope: PanelCommandScope = {
  pluginId: "core.utilities",
  id: "utilities-file-search",
  capabilities: ["files.search", "files.open"],
};

const IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "bmp",
  "svg",
  "ico",
]);

const SEARCH_DEBOUNCE_MS = 500;

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = React.useState(value);

  React.useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timeout);
  }, [value, delayMs]);

  return debounced;
}

function formatIndexedAt(unixMs: number): string {
  if (!unixMs) {
    return "now";
  }
  return new Date(unixMs).toLocaleTimeString();
}

function splitPath(path: string): { fileName: string; parent: string } {
  const normalized = path.replace(/\\/g, "/");
  const chunks = normalized.split("/");
  const fileName = chunks[chunks.length - 1] || path;
  const parent = chunks.slice(0, -1).join("/") || "-";
  return { fileName, parent };
}

export function FileSearchUtilityPanel({
  commandQuery,
  registerInputArrowDownHandler,
  registerInputEnterHandler,
  registerPanelFooter,
  focusLauncherInput,
}: FileSearchUtilityPanelProps) {
  const backend = React.useMemo(() => createPluginBackendSdk(fileSearchCommandScope), []);
  const [results, setResults] = React.useState<FileSearchResult[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [navigationMode, setNavigationMode] = React.useState<"list" | "actions">("list");
  const [selectedActionIndex, setSelectedActionIndex] = React.useState(0);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [previewFailed, setPreviewFailed] = React.useState(false);

  const itemRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const listContainerRef = React.useRef<HTMLDivElement | null>(null);
  const { controlsRef: footerControlsRef, registerFooterControls } = usePanelFooterControlsRef();

  const debouncedQuery = useDebouncedValue(commandQuery, SEARCH_DEBOUNCE_MS);

  const onArrowDownFromLauncher = React.useCallback(() => {
    if (results.length === 0) {
      return false;
    }

    setNavigationMode("list");
    setSelectedIndex(0);
    itemRefs.current[0]?.focus({ preventScroll: true });
    return true;
  }, [results.length]);

  usePanelArrowDownBridge(registerInputArrowDownHandler, onArrowDownFromLauncher);

  React.useEffect(() => {
    const selected = itemRefs.current[selectedIndex];
    selected?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  React.useEffect(() => {
    let cancelled = false;

    const runSearch = async () => {
      const trimmed = debouncedQuery.trim();
      if (!trimmed) {
        setResults([]);
        setErrorMessage(null);
        setSelectedIndex(0);
        return;
      }

      let request: ReturnType<typeof buildSearchRequest>;
      try {
        request = buildSearchRequest(trimmed, 90);
      } catch (error) {
        setResults([]);
        setSelectedIndex(0);
        setErrorMessage(error instanceof Error ? error.message : "Invalid query");
        return;
      }

      setBusy(true);
      setErrorMessage(null);

      try {
        const raw = await backend.files.search<FileSearchResult[]>(request);

        if (cancelled) {
          return;
        }

        const ranked = rankFileSearchResults(
          request.query,
          raw.map((entry) => ({
            path: entry.path,
            fileName: entry.name,
          })),
        );

        const rankedMap = new Map(ranked.map((entry, index) => [entry.path, index]));
        const ordered = [...raw].sort((a, b) => {
          const aRank = rankedMap.get(a.path) ?? Number.MAX_SAFE_INTEGER;
          const bRank = rankedMap.get(b.path) ?? Number.MAX_SAFE_INTEGER;
          if (aRank !== bRank) {
            return aRank - bRank;
          }
          return a.path.localeCompare(b.path);
        });

        setResults(ordered);
        setSelectedIndex((current) => {
          if (ordered.length === 0) {
            return 0;
          }
          return Math.min(current, ordered.length - 1);
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        setResults([]);
        setSelectedIndex(0);
        setErrorMessage(error instanceof Error ? error.message : "File search failed");
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
  }, [debouncedQuery]);

  const openResult = React.useCallback(async (entry: FileSearchResult, reveal = false) => {
    try {
      await backend.files.openPath(entry.path, reveal);
    } catch (error) {
      console.error("[file-search] open failed", error);
      setErrorMessage(error instanceof Error ? error.message : "Could not open file");
    }
  }, [backend.files]);

  const selectedResult = results[selectedIndex] ?? null;
  const selectedExtension = (selectedResult?.extension ?? "").toLowerCase();
  const isImagePreview = selectedResult ? IMAGE_EXTENSIONS.has(selectedExtension) : false;
  const imagePreviewSrc =
    selectedResult && isImagePreview && !previewFailed
      ? backend.files.toAssetUrl(selectedResult.path)
      : null;

  React.useEffect(() => {
    setPreviewFailed(false);
  }, [selectedResult?.path]);

  React.useEffect(() => {
    if (!selectedResult) {
      setNavigationMode("list");
      setSelectedActionIndex(0);
    }
  }, [selectedResult]);

  const appActions = React.useMemo(
    () => [
      { id: "open", label: "Open File", reveal: false, icon: ExternalLink, shortcutHint: "Enter" },
      { id: "reveal", label: "Reveal In Explorer", reveal: true, icon: FolderOpen, shortcutHint: "Shift+Enter" },
    ],
    [],
  );

  const runSelectedAction = React.useCallback(
    (revealOverride?: boolean) => {
      const selected = results[selectedIndex];
      if (!selected) {
        return false;
      }

      if (typeof revealOverride === "boolean") {
        void openResult(selected, revealOverride);
        return true;
      }

      if (navigationMode === "actions") {
        const action = appActions[selectedActionIndex] ?? appActions[0];
        void openResult(selected, action.reveal);
        return true;
      }

      void openResult(selected, false);
      return true;
    },
    [appActions, navigationMode, openResult, results, selectedActionIndex, selectedIndex],
  );

  const footerConfig = React.useMemo<PanelFooterConfig | null>(() => {
    if (!selectedResult) {
      return null;
    }

    return {
      panel: {
        title: "File Search",
        icon: FolderSearch,
      },
      registerControls: registerFooterControls,
      primaryAction: {
        id: "open-file",
        label: "Open File",
        icon: ExternalLink,
        onSelect: () => {
          void openResult(selectedResult, false);
        },
        shortcutHint: "Enter",
      },
      extraActions: [
        {
          id: "reveal-file",
          label: "Reveal In Explorer",
          icon: FolderOpen,
          onSelect: () => {
            void openResult(selectedResult, true);
          },
          shortcutHint: "Shift+Enter",
        },
      ],
    };
  }, [openResult, registerFooterControls, selectedResult]);

  usePanelFooter(registerPanelFooter, footerConfig);

  const focusListItem = React.useCallback(
    (index: number, preventScroll = false) => {
      const target = itemRefs.current[index];
      if (!target) {
        return;
      }
      if (preventScroll) {
        target.focus({ preventScroll: true });
        return;
      }
      target.focus();
    },
    [],
  );

  React.useEffect(() => {
    registerFileSearchInputController({
      moveSelection: (delta) => {
        if (results.length === 0) {
          return false;
        }

        setNavigationMode("list");
        setSelectedIndex((prev) => {
          const next = Math.max(0, Math.min(results.length - 1, prev + delta));
          if (delta < 0 && prev === 0) {
            focusLauncherInput?.();
            return 0;
          }
          focusListItem(next, true);
          return next;
        });
        return true;
      },
      focusActions: () => {
        if (!selectedResult) {
          return false;
        }

        setNavigationMode("actions");
        return true;
      },
      focusList: () => {
        if (navigationMode === "actions") {
          setNavigationMode("list");
          focusListItem(selectedIndex, true);
          return true;
        }
        focusLauncherInput?.();
        return true;
      },
      moveActionSelection: (delta) => {
        if (!selectedResult) {
          return false;
        }

        setNavigationMode("actions");
        setSelectedActionIndex((prev) => Math.max(0, Math.min(appActions.length - 1, prev + delta)));
        return true;
      },
      activateSelection: (revealFromKey) => {
        return runSelectedAction(revealFromKey);
      },
      inActions: () => navigationMode === "actions",
    });

    return () => {
      registerFileSearchInputController(null);
    };
  }, [appActions.length, focusLauncherInput, focusListItem, navigationMode, results, runSelectedAction, selectedIndex, selectedResult]);

  usePanelEnterBridge(registerInputEnterHandler, () => runSelectedAction(false));

  useHotkey(
    "ArrowDown",
    () => {
      if (results.length === 0) {
        return;
      }

      if (navigationMode === "actions") {
        setSelectedActionIndex((prev) => Math.min(prev + 1, appActions.length - 1));
        return;
      }

      setNavigationMode("list");
      setSelectedIndex((prev) => {
        const next = Math.min(prev + 1, results.length - 1);
        focusListItem(next);
        return next;
      });
    },
    { enabled: results.length > 0, preventDefault: true },
  );

  useHotkey(
    "ArrowUp",
    () => {
      if (results.length === 0) {
        return;
      }

      if (navigationMode === "actions") {
        setSelectedActionIndex((prev) => {
          const next = prev - 1;
          if (next >= 0) {
            return next;
          }
          setNavigationMode("list");
          focusListItem(selectedIndex);
          return 0;
        });
        return;
      }

      if (selectedIndex === 0) {
        focusLauncherInput?.();
        return;
      }

      setSelectedIndex((prev) => {
        const next = Math.max(0, prev - 1);
        focusListItem(next);
        return next;
      });
    },
    { enabled: results.length > 0, preventDefault: true },
  );

  useHotkey(
    "ArrowRight",
    () => {
      if (!selectedResult) {
        return;
      }
      setNavigationMode("actions");
      setSelectedActionIndex((prev) => Math.min(prev, appActions.length - 1));
    },
    { enabled: !!selectedResult, preventDefault: true },
  );

  useHotkey(
    "ArrowLeft",
    () => {
      if (navigationMode === "actions") {
        setNavigationMode("list");
        focusListItem(selectedIndex);
        return;
      }
      focusLauncherInput?.();
    },
    { enabled: results.length > 0, preventDefault: true },
  );

  useHotkey(
    "Enter",
    () => {
      void runSelectedAction(false);
    },
    { enabled: !!selectedResult, preventDefault: true },
  );

  useHotkey(
    "Shift+Enter",
    () => {
      void runSelectedAction(true);
    },
    { enabled: !!selectedResult, preventDefault: true },
  );

  useHotkey(
    "Alt+K",
    () => {
      footerControlsRef.current?.openExtraActions();
    },
    { enabled: !!selectedResult, preventDefault: true },
  );

  return (
    <PanelTooltipProvider>
      <PanelGrid columns="two-pane" gap="sm" style={{ height: "100%" }}>
        <PanelSection style={{ height: "100%", overflow: "hidden" }}>
          <PanelScrollArea style={{ height: "calc(100% - 3.25rem)" }}>
            <PanelContainer ref={listContainerRef} tabIndex={0} padding="md" style={{ outline: "none" }}>
              <PanelList gap="sm">
                {results.map((entry, index) => {
                  const active = index === selectedIndex;
                  const pathInfo = splitPath(entry.path);

                  return (
                    <PanelListItem
                      key={entry.path}
                      active={active}
                      ref={(el) => {
                        itemRefs.current[index] = el;
                      }}
                      onMouseEnter={() => setSelectedIndex(index)}
                      onClick={() => {
                        setNavigationMode("list");
                        setSelectedIndex(index);
                        void openResult(entry, false);
                      }}
                      title={entry.path}
                    >
                      <PanelText size="sm" weight="medium" truncate>
                        {pathInfo.fileName}
                      </PanelText>
                    </PanelListItem>
                  );
                })}
              </PanelList>

              {!busy && !errorMessage && results.length === 0 && commandQuery.trim().length > 0 && (
                <PanelContainer surface="muted" padding="md">
                  <PanelEmpty>
                  <PanelEmptyHeader>
                    <PanelEmptyMedia variant="icon">
                      <FileSearch size={20} />
                    </PanelEmptyMedia>
                    <PanelEmptyTitle>No matching files</PanelEmptyTitle>
                    <PanelEmptyDescription>
                      Try fewer words or include a root path using <PanelCode>in C:\\path</PanelCode>.
                    </PanelEmptyDescription>
                  </PanelEmptyHeader>
                  </PanelEmpty>
                </PanelContainer>
              )}

              {!busy && !errorMessage && results.length === 0 && commandQuery.trim().length === 0 && (
                <PanelContainer surface="muted" padding="md">
                  <PanelEmpty>
                  <PanelEmptyHeader>
                    <PanelEmptyMedia variant="icon">
                      <FolderSearch size={20} />
                    </PanelEmptyMedia>
                    <PanelEmptyTitle>Start typing a file query</PanelEmptyTitle>
                    <PanelEmptyDescription>
                      Example: <PanelCode>files invoice in C:\\Users\\ardev\\Documents</PanelCode>
                    </PanelEmptyDescription>
                  </PanelEmptyHeader>
                  </PanelEmpty>
                </PanelContainer>
              )}

              {busy && (
                <PanelContainer style={{ display: "grid", height: "6rem", placeItems: "center" }}>
                  <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
                </PanelContainer>
              )}
            </PanelContainer>
          </PanelScrollArea>
        </PanelSection>

        <PanelAside style={{ width: "100%", overflow: "hidden" }}>
          <PanelContainer style={{ height: "100%", width: "100%", overflow: "hidden" }}>
            <PanelScrollArea style={{ height: "100%" }}>
              <PanelContainer padding="md">
                {selectedResult && (
                  <PanelFlex direction="col" gap="sm">
                    <PanelText size="xs" tone="muted" style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      Preview
                    </PanelText>
                    {imagePreviewSrc ? (
                      <PanelContainer surface="muted" padding="sm">
                        <PanelFigureImage
                          src={imagePreviewSrc}
                          alt={selectedResult.name}
                          loading="lazy"
                          onError={() => setPreviewFailed(true)}
                          style={{ width: "100%", height: "9rem" }}
                        />
                      </PanelContainer>
                    ) : (
                      <PanelContainer surface="muted" padding="md">
                        <PanelText size="xs" tone="muted">
                          {isImagePreview
                            ? "Image preview unavailable for this file."
                            : "Preview is available for image files (png, jpg, webp, svg...)."}
                        </PanelText>
                      </PanelContainer>
                    )}
                  </PanelFlex>
                )}

                <PanelFlex direction="col" gap="md" style={{ marginTop: "0.875rem", height: "100%" }}>
                  <PanelContainer>
                    <PanelMetaGrid>
                      <PanelText tone="muted">Results</PanelText>
                      <PanelText style={{ textAlign: "right" }}>{results.length}</PanelText>
                      <PanelText tone="muted">Indexed At</PanelText>
                      <PanelText style={{ textAlign: "right" }}>
                        {selectedResult ? formatIndexedAt(selectedResult.indexedAt) : "-"}
                      </PanelText>
                    </PanelMetaGrid>
                  </PanelContainer>

                  {selectedResult && (
                    <PanelFlex direction="col" gap="sm">
                      <PanelText size="xs" tone="muted" style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}>
                        Properties
                      </PanelText>
                      <PanelMetaGrid>
                        <PanelText tone="muted">File</PanelText>
                        <PanelTooltip>
                          <PanelTooltipTrigger>
                            <PanelText truncate style={{ textAlign: "right" }} title={selectedResult.name}>
                              {selectedResult.name}
                            </PanelText>
                          </PanelTooltipTrigger>
                          <PanelTooltipContent side="left" align="end">
                            <PanelText size="xs">{selectedResult.name}</PanelText>
                          </PanelTooltipContent>
                        </PanelTooltip>
                        <PanelText tone="muted">Path</PanelText>
                        <PanelTooltip>
                          <PanelTooltipTrigger>
                            <PanelText truncate style={{ textAlign: "right" }} title={selectedResult.path}>
                              {selectedResult.path}
                            </PanelText>
                          </PanelTooltipTrigger>
                          <PanelTooltipContent side="left" align="end" style={{ maxWidth: "28rem" }}>
                            <PanelText size="xs" style={{ overflowWrap: "anywhere" }}>
                              {selectedResult.path}
                            </PanelText>
                          </PanelTooltipContent>
                        </PanelTooltip>
                      </PanelMetaGrid>
                    </PanelFlex>
                  )}

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
                    <PanelFlex align="center" justify="between">
                      <PanelText size="xs" tone="muted">
                        Open
                      </PanelText>
                      <PanelText size="xs" tone="muted" mono>
                        Enter
                      </PanelText>
                    </PanelFlex>
                    <PanelContainer padding="xs" />
                    <PanelFlex align="center" justify="between">
                      <PanelText size="xs" tone="muted">
                        Reveal
                      </PanelText>
                      <PanelText size="xs" tone="muted" mono>
                        Shift+Enter
                      </PanelText>
                    </PanelFlex>
                    <PanelContainer padding="xs" />
                    <PanelFlex align="center" justify="between">
                      <PanelText size="xs" tone="muted">
                        List to Actions
                      </PanelText>
                      <PanelText size="xs" tone="muted" mono>
                        Right Arrow
                      </PanelText>
                    </PanelFlex>
                    <PanelContainer padding="xs" />
                    <PanelFlex align="center" justify="between">
                      <PanelText size="xs" tone="muted">
                        Actions to List
                      </PanelText>
                      <PanelText size="xs" tone="muted" mono>
                        Left Arrow
                      </PanelText>
                    </PanelFlex>
                  </PanelContainer>
                </PanelFlex>
              </PanelContainer>
            </PanelScrollArea>
          </PanelContainer>
        </PanelAside>
      </PanelGrid>
    </PanelTooltipProvider>
  );
}
