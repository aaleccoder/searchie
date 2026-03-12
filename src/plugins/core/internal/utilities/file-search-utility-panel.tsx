import * as React from "react";
import { FolderSearch, Loader2, FolderOpen, FileSearch, ExternalLink } from "lucide-react";
import {
  Button as PanelButton,
  Empty as PanelEmpty,
  EmptyDescription as PanelEmptyDescription,
  EmptyHeader as PanelEmptyHeader,
  EmptyMedia as PanelEmptyMedia,
  EmptyTitle as PanelEmptyTitle,
  ScrollArea as PanelScrollArea,
  createPluginBackendSdk,
  usePanelArrowDownBridge,
} from "@/plugins/sdk";
import { registerFileSearchInputController } from "@/plugins/core/internal/utilities/file-search-keybindings";
import type { PanelCommandScope } from "@/lib/tauri-commands";
import { buildSearchRequest, rankFileSearchResults } from "@/lib/utilities/file-search-engine";
import { cn } from "@/lib/utils";

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

  const debouncedQuery = useDebouncedValue(commandQuery, 110);

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
    <div className="grid h-full grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] gap-2.5 items-stretch">
      <section className="min-w-0 overflow-hidden h-full">

        <PanelScrollArea className="h-[calc(100%-3.25rem)]">
          <div
            ref={listContainerRef}
            tabIndex={0}
            onKeyDown={onListKeyDown}
            className="p-3.5 space-y-2 outline-none"
          >
            {results.map((entry, index) => {
              const active = index === selectedIndex;
              const pathInfo = splitPath(entry.path);

              return (
                <button
                  key={entry.path}
                  type="button"
                  ref={(el) => {
                    itemRefs.current[index] = el;
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  onClick={() => {
                    setFocusArea("list");
                    setSelectedIndex(index);
                    void openResult(entry, false);
                  }}
                  className={cn(
                    "w-full min-w-0 rounded-lg border px-3 py-2 text-left transition",
                    active
                      ? "border-primary/70 bg-primary/10"
                      : "border-border/55 hover:border-primary/45 hover:bg-accent/40",
                  )}
                >
                  <div className="flex min-w-0 items-center justify-between gap-2">
                    <p className="min-w-0 flex-1 truncate text-sm font-medium">{pathInfo.fileName}</p>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{entry.extension ?? "file"}</span>
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{pathInfo.parent}</p>
                </button>
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
                    Try fewer words or include a root path using <code>in C:\\path</code>.
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
                    Example: <code>files invoice in C:\\Users\\ardev\\Documents</code>
                  </PanelEmptyDescription>
                </PanelEmptyHeader>
              </PanelEmpty>
            )}

            {busy && (
              <div className="h-24 grid place-items-center text-muted-foreground text-sm">
                <Loader2 className="size-4 animate-spin" />
              </div>
            )}
          </div>
        </PanelScrollArea>
      </section>

      <aside className="min-w-0 rounded-xl border border-border/70 bg-card/92 shadow-lg p-3.5 flex flex-col gap-3.5">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">File Search</p>
          <h3 className="text-xl font-semibold leading-tight">Local Index</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Fast fuzzy lookup over a cached file index. Scope search with <code>in C:\\dir</code>.
          </p>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Results</span>
            <span className="text-right">{results.length}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Indexed At</span>
            <span className="text-right">{selectedResult ? formatIndexedAt(selectedResult.indexedAt) : "-"}</span>
          </div>
        </div>

        {selectedResult && (
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Preview</p>
            {imagePreviewSrc ? (
              <div className="rounded-md border border-border/60 bg-muted/20 p-2">
                <img
                  src={imagePreviewSrc}
                  alt={selectedResult.name}
                  className="h-36 w-full rounded object-contain"
                  loading="lazy"
                  onError={() => setPreviewFailed(true)}
                />
              </div>
            ) : (
              <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
                {isImagePreview
                  ? "Image preview unavailable for this file."
                  : "Preview is available for image files (png, jpg, webp, svg...)."}
              </div>
            )}
          </div>
        )}

        {selectedResult && (
          <div className="space-y-2">
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
          </div>
        )}

        {errorMessage && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
            {errorMessage}
          </div>
        )}

        <div className="mt-auto space-y-2 text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>Enter</span>
            <span className="font-mono">Open</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Shift+Enter</span>
            <span className="font-mono">Reveal</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Arrows</span>
            <span className="font-mono">Navigate</span>
          </div>
        </div>
      </aside>
    </div>
  );
}
