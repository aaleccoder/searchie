import { describe, expect, it, vi } from "vitest";
import { createPanelRegistry } from "@/lib/panel-registry";
import type { ShortcutPanelDescriptor } from "@/lib/panel-contract";

function makePanel(
  id: string,
  aliases: string[],
  priority = 0,
): ShortcutPanelDescriptor {
  return {
    id,
    name: id,
    aliases,
    priority,
    capabilities: [],
    matcher: () => ({ matches: false, commandQuery: "" }),
    component: () => null,
  };
}

describe("createPanelRegistry", () => {
  it("registers and lists panels", () => {
    const registry = createPanelRegistry();
    registry.register(makePanel("clipboard", ["cl"]));
    registry.register(makePanel("calc", ["calc"]));

    expect(registry.list().map((panel) => panel.id)).toEqual(["clipboard", "calc"]);
  });

  it("throws when duplicate id is registered", () => {
    const registry = createPanelRegistry();
    registry.register(makePanel("clipboard", ["cl"]));

    expect(() => registry.register(makePanel("clipboard", ["clipboard"]))).toThrow(
      /already registered/i,
    );
  });

  it("finds the highest-priority matching panel", () => {
    const registry = createPanelRegistry();

    registry.register({
      ...makePanel("first", ["x"], 1),
      matcher: () => ({ matches: true, commandQuery: "a" }),
    });
    registry.register({
      ...makePanel("second", ["x"], 2),
      matcher: () => ({ matches: true, commandQuery: "b" }),
    });

    const result = registry.find("x");
    expect(result?.panel.id).toBe("second");
    expect(result?.match.commandQuery).toBe("b");
  });

  it("warns on alias collisions", () => {
    const warn = vi.fn();
    const registry = createPanelRegistry({ onAliasCollision: warn });

    registry.register(makePanel("clipboard", ["cl"]));
    registry.register(makePanel("calc", ["cl", "calc"]));

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain("cl");
  });

  it("returns null when no panel matches", () => {
    const registry = createPanelRegistry();
    registry.register(makePanel("clipboard", ["cl"]));

    expect(registry.find("unknown")).toBeNull();
  });
});
