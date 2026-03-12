import * as React from "react";
import { FolderSearch, Loader2, FolderOpen, FileSearch, ExternalLink } from "lucide-react";
import {
  Button as PanelButton,
  Empty as PanelEmpty,
  EmptyDescription as PanelEmptyDescription,
  EmptyHeader as PanelEmptyHeader,
  EmptyMedia as PanelEmptyMedia,
  EmptyTitle as PanelEmptyTitle,
  Grid as PanelGrid,
  MetaGrid as PanelMetaGrid,
  ListItem as PanelListItem,
  ScrollArea as PanelScrollArea,
  PanelAside,
  PanelCode,
  PanelContainer,
  PanelFigureImage,
  PanelFlex,
  PanelHeading,
  PanelParagraph,
  PanelSection,
  PanelText,
  Tooltip as PanelTooltip,
  TooltipContent as PanelTooltipContent,
  TooltipProvider as PanelTooltipProvider,
  TooltipTrigger as PanelTooltipTrigger,
  createPluginBackendSdk,
  usePanelArrowDownBridge,
} from "@/plugins/sdk";
import type { PanelCommandScope } from "@/lib/tauri-commands";
import { buildSearchRequest, rankFileSearchResults } from "@/lib/utilities/file-search-engine";
import { cn } from "@/lib/utils";
import { registerFileSearchInputController } from "./file-search-keybindings";

type FileSearchUtilityPanelProps = {
  commandQuery: string;
  registerInputArrowDownHandler?: ((handler: (() => boolean | void) | null) => void) | undefined;
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
  focusLauncherInput,
}: FileSearchUtilityPanelProps) {
  const backend = React.useMemo(() => createPluginBackendSdk(fileSearchCommandScope), []);
  const [results, setResults] = React.useState<FileSearchResult[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [focusArea, setFocusArea] = React.useState<"list" | "actions">("list");
  const [selectedActionIndex, setSelectedActionIndex] = React.useState(0);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [previewFailed, setPreviewFailed] = React.useState(false);

  const itemRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const listContainerRef = React.useRef<HTMLDivElement | null>(null);

  const debouncedQuery = useDebouncedValue(commandQuery, SEARCH_DEBOUNCE_MS);

  const onArrowDownFromLauncher = React.useCallback(() => {
    if (!listContainerRef.current || results.length === 0) {
      return false;
    }

    listContainerRef.current.focus();
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
  const actions = React.useMemo(
    () => [
      { id: "open", label: "Open File", reveal: false },
      { id: "reveal", label: "Reveal In Explorer", reveal: true },
    ],
    [],
  );
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
      setFocusArea("list");
      setSelectedActionIndex(0);
    }
  }, [selectedResult]);

  React.useEffect(() => {
    registerFileSearchInputController({
      moveSelection: (delta) => {
        if (results.length === 0) {
          return false;
        }

        setFocusArea("list");
        setSelectedIndex((prev) => Math.max(0, Math.min(results.length - 1, prev + delta)));
        return true;
      },
      focusActions: () => {
        if (!selectedResult) {
          return false;
        }

        setFocusArea("actions");
        return true;
      },
      moveActionSelection: (delta) => {
        if (!selectedResult) {
          return false;
        }

        setFocusArea("actions");
        setSelectedActionIndex((prev) => Math.max(0, Math.min(actions.length - 1, prev + delta)));
        return true;
      },
      activateSelection: (revealFromKey) => {
        const selected = results[selectedIndex];
        if (!selected) {
          return false;
        }

        if (focusArea === "actions") {
          const action = actions[selectedActionIndex] ?? actions[0];
          void openResult(selected, action.reveal);
          return true;
        }

        void openResult(selected, revealFromKey);
        return true;
      },
      inActions: () => focusArea === "actions",
    });

    return () => {
      registerFileSearchInputController(null);
    };
  }, [actions, focusArea, openResult, results, selectedActionIndex, selectedIndex, selectedResult]);

  const onListKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (results.length === 0) {
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (focusArea === "actions") {
          setSelectedActionIndex((prev) => Math.min(prev + 1, actions.length - 1));
          return;
        }
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        if (focusArea === "actions") {
          setSelectedActionIndex((prev) => Math.max(0, prev - 1));
          return;
        }
        if (selectedIndex === 0) {
          focusLauncherInput?.();
          return;
        }
        setSelectedIndex((prev) => Math.max(0, prev - 1));
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        const selected = results[selectedIndex];
        if (selected) {
          if (focusArea === "actions") {
            const action = actions[selectedActionIndex] ?? actions[0];
            void openResult(selected, action.reveal);
            return;
          }
          void openResult(selected, event.shiftKey);
        }
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        setFocusArea("actions");
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        if (focusArea === "actions") {
          setFocusArea("list");
          return;
        }
        focusLauncherInput?.();
      }
    },
    [actions, focusArea, focusLauncherInput, openResult, results, selectedActionIndex, selectedIndex],
  );

  return (
    <PanelTooltipProvider>
      <PanelGrid columns="single" className="h-full grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2.5">
      <PanelSection className="min-w-0 h-full overflow-hidden">
        <PanelScrollArea className="h-[calc(100%-3.25rem)]">
          <PanelContainer
            ref={listContainerRef}
            tabIndex={0}
            onKeyDown={onListKeyDown}
            className="p-3.5 space-y-2 outline-none"
          >
            {results.map((entry, index) => {
              const active = index === selectedIndex;
              const pathInfo = splitPath(entry.path);

              return (
                <PanelListItem
                  key={entry.path}
                  ref={(el) => {
                    itemRefs.current[index] = el;
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  onClick={() => {
                    setFocusArea("list");
                    setSelectedIndex(index);
                    void openResult(entry, false);
                  }}
                  title={entry.path}
                  className={cn(
                    active
                      ? "border-primary/70 bg-primary/10"
                      : "border-border/55 hover:border-primary/45 hover:bg-accent/40",
                  )}
                >
                  <PanelText className="block min-w-0" size="sm" weight="medium" truncate>
                    {pathInfo.fileName}
                  </PanelText>
                </PanelListItem>
              );
            })}

            {!busy && !errorMessage && results.length === 0 && commandQuery.trim().length > 0 && (
              <PanelEmpty className="border-border/60">
                <PanelEmptyHeader>
                  <PanelEmptyMedia variant="icon">
                    <FileSearch className="size-5" />
                  </PanelEmptyMedia>
                  <PanelEmptyTitle>No matching files</PanelEmptyTitle>
                  <PanelEmptyDescription>
                    Try fewer words or include a root path using <PanelCode>in C:\\path</PanelCode>.
                  </PanelEmptyDescription>
                </PanelEmptyHeader>
              </PanelEmpty>
            )}

            {!busy && !errorMessage && results.length === 0 && commandQuery.trim().length === 0 && (
              <PanelEmpty className="border-border/60">
                <PanelEmptyHeader>
                  <PanelEmptyMedia variant="icon">
                    <FolderSearch className="size-5" />
                  </PanelEmptyMedia>
                  <PanelEmptyTitle>Start typing a file query</PanelEmptyTitle>
                  <PanelEmptyDescription>
                    Example: <PanelCode>files invoice in C:\\Users\\ardev\\Documents</PanelCode>
                  </PanelEmptyDescription>
                </PanelEmptyHeader>
              </PanelEmpty>
            )}

            {busy && (
              <PanelContainer className="grid h-24 place-items-center text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
              </PanelContainer>
            )}
          </PanelContainer>
        </PanelScrollArea>
      </PanelSection>

      <PanelAside className="min-w-0 w-full overflow-hidden">
        <PanelContainer surface="panel" className="h-full min-w-0 w-full p-3.5 overflow-hidden">
          <PanelFlex direction="col" gap="md" className="h-full">
            <PanelContainer className="space-y-2">
              <PanelText className="uppercase tracking-wider" size="xs" tone="muted">
                File Search
              </PanelText>
              <PanelHeading level={2}>Local Index</PanelHeading>
              <PanelParagraph className="leading-relaxed" tone="muted" size="sm">
                Fast fuzzy lookup over a cached file index. Scope search with <PanelCode>in C:\\dir</PanelCode>.
              </PanelParagraph>
            </PanelContainer>

            <PanelContainer className="space-y-2">
              <PanelMetaGrid className="text-sm">
                <PanelText tone="muted">Results</PanelText>
                <PanelText className="text-right">{results.length}</PanelText>
                <PanelText tone="muted">Indexed At</PanelText>
                <PanelText className="text-right">
                  {selectedResult ? formatIndexedAt(selectedResult.indexedAt) : "-"}
                </PanelText>
              </PanelMetaGrid>
            </PanelContainer>

            {selectedResult && (
              <PanelContainer className="space-y-2">
                <PanelText className="uppercase tracking-wider" size="xs" tone="muted">
                  Properties
                </PanelText>
                <PanelMetaGrid className="text-sm">
                  <PanelText tone="muted">File</PanelText>
                  <PanelTooltip>
                    <PanelTooltipTrigger>
                      <PanelText className="cursor-default truncate text-right" title={selectedResult.name}>
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
                      <PanelText className="cursor-default truncate text-right" title={selectedResult.path}>
                        {selectedResult.path}
                      </PanelText>
                    </PanelTooltipTrigger>
                    <PanelTooltipContent side="left" align="end" className="max-w-md">
                      <PanelText size="xs" className="break-all">
                        {selectedResult.path}
                      </PanelText>
                    </PanelTooltipContent>
                  </PanelTooltip>
                </PanelMetaGrid>
              </PanelContainer>
            )}

            {selectedResult && (
              <PanelContainer className="space-y-2">
                <PanelText className="uppercase tracking-wider" size="xs" tone="muted">
                  Preview
                </PanelText>
                {imagePreviewSrc ? (
                  <PanelContainer className="rounded-md border border-border/60 bg-muted/20 p-2">
                    <PanelFigureImage
                      src={imagePreviewSrc}
                      alt={selectedResult.name}
                      className="h-36 w-full rounded object-contain"
                      loading="lazy"
                      onError={() => setPreviewFailed(true)}
                    />
                  </PanelContainer>
                ) : (
                  <PanelContainer className="rounded-md border border-border/60 bg-muted/20 p-3">
                    <PanelText size="xs" tone="muted">
                      {isImagePreview
                        ? "Image preview unavailable for this file."
                        : "Preview is available for image files (png, jpg, webp, svg...)."}
                    </PanelText>
                  </PanelContainer>
                )}
              </PanelContainer>
            )}

            {selectedResult && (
              <PanelContainer className="space-y-2">
                <PanelButton
                  type="button"
                  variant={focusArea === "actions" && selectedActionIndex === 0 ? "default" : "secondary"}
                  className={cn("w-full", focusArea === "actions" && selectedActionIndex === 0 && "ring-2 ring-primary/40")}
                  onMouseEnter={() => {
                    setFocusArea("actions");
                    setSelectedActionIndex(0);
                  }}
                  onClick={() => void openResult(selectedResult, false)}
                >
                  <ExternalLink className="size-4" />
                  Open File
                </PanelButton>
                <PanelButton
                  type="button"
                  variant={focusArea === "actions" && selectedActionIndex === 1 ? "default" : "outline"}
                  className={cn("w-full", focusArea === "actions" && selectedActionIndex === 1 && "ring-2 ring-primary/40")}
                  onMouseEnter={() => {
                    setFocusArea("actions");
                    setSelectedActionIndex(1);
                  }}
                  onClick={() => void openResult(selectedResult, true)}
                >
                  <FolderOpen className="size-4" />
                  Reveal In Explorer
                </PanelButton>
              </PanelContainer>
            )}

            {errorMessage && (
              <PanelContainer className="rounded-md border border-destructive/30 bg-destructive/10 p-2">
                <PanelText size="xs" className="text-destructive">
                  {errorMessage}
                </PanelText>
              </PanelContainer>
            )}

            <PanelContainer className="mt-auto space-y-2">
              <PanelFlex align="center" justify="between">
                <PanelText size="xs" tone="muted">
                  Enter
                </PanelText>
                <PanelText size="xs" tone="muted" mono>
                  Open
                </PanelText>
              </PanelFlex>
              <PanelFlex align="center" justify="between">
                <PanelText size="xs" tone="muted">
                  Shift+Enter
                </PanelText>
                <PanelText size="xs" tone="muted" mono>
                  Reveal
                </PanelText>
              </PanelFlex>
              <PanelFlex align="center" justify="between">
                <PanelText size="xs" tone="muted">
                  Arrows
                </PanelText>
                <PanelText size="xs" tone="muted" mono>
                  Navigate
                </PanelText>
              </PanelFlex>
            </PanelContainer>
          </PanelFlex>
        </PanelContainer>
      </PanelAside>
      </PanelGrid>
    </PanelTooltipProvider>
  );
}
