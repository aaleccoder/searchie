import * as React from "react";
import { Kbd as PanelKbd, KbdGroup as PanelKbdGroup, ScrollArea as PanelScrollArea } from "@/plugins/sdk";
import type { ShortcutPanelDescriptor } from "@/lib/panel-contract";
import { resolveLauncherShortcutHints } from "@/lib/panel-shortcuts";
import { usePanelRegistry } from "@/lib/panel-registry";

type HotkeysShortcutPanelProps = {
  commandQuery: string;
};

function formatShortcutPart(part: string): string {
  const normalized = part.trim().toLowerCase();
  if (normalized === "mod") return "Ctrl/Cmd";
  if (normalized === "arrowup") return "Up";
  if (normalized === "arrowdown") return "Down";
  if (normalized === "arrowleft") return "Left";
  if (normalized === "arrowright") return "Right";
  return part.trim();
}

export function HotkeysShortcutPanel({ commandQuery }: HotkeysShortcutPanelProps) {
  const panelRegistry = usePanelRegistry();
  const contextPanel = React.useMemo<ShortcutPanelDescriptor | null>(() => {
    const contextId = commandQuery.trim();
    if (!contextId || contextId === "launcher") {
      return null;
    }

    return panelRegistry.list().find((panel) => panel.id === contextId) ?? null;
  }, [commandQuery, panelRegistry]);

  const shortcutHints = React.useMemo(
    () => resolveLauncherShortcutHints(contextPanel),
    [contextPanel],
  );
  const contextLabel = contextPanel?.name ?? "Launcher";

  return (
    <div className="h-full overflow-hidden">
      <PanelScrollArea className="h-full">
        <div className="p-4 space-y-4">
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Hotkeys</p>
            <h2 className="text-base font-semibold leading-tight">{contextLabel} keyboard shortcuts</h2>
            <p className="text-xs text-muted-foreground">
              Shortcuts available for the current launcher context.
            </p>
          </div>

          <div className="space-y-2">
            {shortcutHints.map((hint) => (
              <div
                key={`${hint.keys}:${hint.description}`}
                className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-background/60 px-3 py-2"
              >
                <span className="text-xs text-muted-foreground">{hint.description}</span>
                <PanelKbdGroup>
                  {hint.keys.split("+").map((part) => (
                    <PanelKbd key={`${hint.keys}:${part}`}>{formatShortcutPart(part)}</PanelKbd>
                  ))}
                </PanelKbdGroup>
              </div>
            ))}
          </div>
        </div>
      </PanelScrollArea>
    </div>
  );
}
