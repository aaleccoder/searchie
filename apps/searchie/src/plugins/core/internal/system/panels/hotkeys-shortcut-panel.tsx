import * as React from "react";
import {
  PanelFlex,
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
    <PanelContainer style={{ height: "100%", overflow: "hidden" }}>
      <PanelScrollArea style={{ height: "100%" }}>
        <PanelContainer
          padding="lg"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
          }}
        >
          <PanelFlex direction="col" gap="xs">
            <PanelText size="xs" tone="muted" style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Hotkeys
            </PanelText>
            <PanelHeading level={2} style={{ fontSize: "1rem" }}>
              {contextLabel} keyboard shortcuts
            </PanelHeading>
            <PanelParagraph size="xs" tone="muted">
              Shortcuts available for the current launcher context.
            </PanelParagraph>
          </PanelFlex>

          <PanelFlex direction="col" gap="sm">
            {shortcutHints.map((hint) => (
              <PanelContainer
                key={`${hint.keys}:${hint.description}`}
                radius="md"
                padding="sm"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "0.5rem",
                  border: "1px solid color-mix(in oklab, hsl(var(--border)) 60%, transparent)",
                  backgroundColor: "color-mix(in oklab, hsl(var(--background)) 60%, transparent)",
                }}
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
          </PanelFlex>
        </PanelContainer>
      </PanelScrollArea>
    </PanelContainer>
  );
}
