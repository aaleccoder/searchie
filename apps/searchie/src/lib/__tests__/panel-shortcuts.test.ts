import { describe, expect, it } from "vitest";
import { definePanel } from "@/components/framework";
import { resolveLauncherShortcutHints } from "@/lib/panel-shortcuts";
import type { ShortcutPanelDescriptor } from "@/lib/panel-contract";

function createPanel(overrides: Partial<ShortcutPanelDescriptor>): ShortcutPanelDescriptor {
  return definePanel({
    id: "test-panel",
    name: "Test Panel",
    aliases: ["tp"],
    capabilities: [],
    matcher: () => ({ matches: true, commandQuery: "" }),
    component: () => null,
    ...overrides,
  });
}

describe("resolveLauncherShortcutHints", () => {
  it("returns launcher shortcuts when no panel is active", () => {
    const hints = resolveLauncherShortcutHints(null);
    expect(hints.some((hint) => hint.keys === "Enter")).toBe(true);
    expect(hints.some((hint) => hint.keys === "Escape")).toBe(true);
  });

  it("prefers panel-defined shortcuts", () => {
    const panel = createPanel({
      shortcuts: [{ keys: "Mod+K", description: "Do panel action" }],
    });

    expect(resolveLauncherShortcutHints(panel)).toEqual([
      { keys: "Mod+K", description: "Do panel action" },
    ]);
  });

  it("falls back to generic panel escape hint when panel has no shortcuts", () => {
    const panel = createPanel({ shortcuts: [] });

    expect(resolveLauncherShortcutHints(panel)).toEqual([
      { keys: "Escape", description: "Back to panel command launcher" },
    ]);
  });
});
