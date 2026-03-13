import type { PanelShortcutHint, ShortcutPanelDescriptor } from "@/lib/panel-contract";

const LAUNCHER_SHORTCUTS: PanelShortcutHint[] = [
  { keys: "ArrowUp / ArrowDown", description: "Navigate command panels" },
  { keys: "Enter", description: "Open selected panel" },
  { keys: "Escape", description: "Clear query or hide launcher" },
];

const PANEL_SHORTCUT_FALLBACKS: Record<string, PanelShortcutHint[]> = {
  clipboard: [
    { keys: "Enter", description: "Copy selected item" },
    { keys: "Mod+O", description: "Open link(s) from selected item" },
    { keys: "Mod+Shift+P", description: "Pin or unpin selected item" },
    { keys: "Mod+P", description: "Cycle clipboard filter" },
    { keys: "Control+X", description: "Delete selected item" },
    { keys: "Control+Shift+X", description: "Clear clipboard history" },
  ],
};

export function resolveLauncherShortcutHints(
  activePanel: ShortcutPanelDescriptor | null,
): PanelShortcutHint[] {
  if (!activePanel) {
    return LAUNCHER_SHORTCUTS;
  }

  const panelShortcuts = activePanel.shortcuts?.length
    ? activePanel.shortcuts
    : PANEL_SHORTCUT_FALLBACKS[activePanel.id] ?? [];

  if (panelShortcuts.length > 0) {
    return panelShortcuts;
  }

  return [{ keys: "Escape", description: "Back to panel command launcher" }];
}
