import * as React from "react";
import {
  Kbd as PanelKbd,
  KbdGroup as PanelKbdGroup,
  PanelContainer,
  PanelHeading,
  PanelParagraph,
  PanelText,
  ScrollArea as PanelScrollArea,
} from "@/plugins/sdk";
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
    <PanelContainer className="h-full overflow-hidden">
      <PanelScrollArea className="h-full">
        <PanelContainer className="p-4 space-y-4">
          <PanelContainer className="space-y-1">
            <PanelText size="xs" tone="muted" className="uppercase tracking-wider">
              Hotkeys
            </PanelText>
            <PanelHeading level={2} className="text-base">
              {contextLabel} keyboard shortcuts
            </PanelHeading>
            <PanelParagraph size="xs" tone="muted">
              Shortcuts available for the current launcher context.
            </PanelParagraph>
          </PanelContainer>

          <PanelContainer className="space-y-2">
            {shortcutHints.map((hint) => (
              <PanelContainer
                key={`${hint.keys}:${hint.description}`}
                className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-background/60 px-3 py-2"
              >
                <PanelText size="xs" tone="muted">
                  {hint.description}
                </PanelText>
                <PanelKbdGroup>
                  {hint.keys.split("+").map((part) => (
                    <PanelKbd key={`${hint.keys}:${part}`}>{formatShortcutPart(part)}</PanelKbd>
                  ))}
                </PanelKbdGroup>
              </PanelContainer>
            ))}
          </PanelContainer>
        </PanelContainer>
      </PanelScrollArea>
    </PanelContainer>
  );
}
