import { describe, expect, it, vi } from "vitest";
import { createPluginRegistry } from "@/lib/plugin-registry";
import type { CorePluginDescriptor } from "@/lib/plugin-contract";

function createPlugin(overrides: Partial<CorePluginDescriptor>): CorePluginDescriptor {
  return {
    id: "plugin.alpha",
    name: "Alpha",
    version: "0.1.0",
    permissions: ["apps.search"],
    panels: [
      {
        id: "panel.alpha",
        name: "Alpha Panel",
        aliases: ["alpha"],
        capabilities: ["apps.search"],
        matcher: () => ({ matches: true, commandQuery: "" }),
        component: () => null,
      },
    ],
    ...overrides,
  };
}

describe("createPluginRegistry", () => {
  it("registers plugins and tags panel pluginId", () => {
    const registry = createPluginRegistry();
    const plugin = createPlugin({});

    registry.register(plugin);

    const panels = registry.listPanels();
    expect(panels).toHaveLength(1);
    expect(panels[0]?.pluginId).toBe("plugin.alpha");
  });

  it("rejects duplicate plugin ids", () => {
    const registry = createPluginRegistry();
    registry.register(createPlugin({ id: "same.plugin" }));

    expect(() => {
      registry.register(createPlugin({ id: "same.plugin", panels: [] }));
    }).toThrow(/already registered/i);
  });

  it("rejects panel capabilities outside plugin permissions", () => {
    const registry = createPluginRegistry();

    expect(() => {
      registry.register(
        createPlugin({
          permissions: ["apps.search"],
          panels: [
            {
              id: "panel.bad",
              name: "Bad",
              aliases: ["bad"],
              capabilities: ["apps.launch"],
              matcher: () => ({ matches: true, commandQuery: "" }),
              component: () => null,
            },
          ],
        }),
      );
    }).toThrow(/not allowed by plugin/i);
  });

  it("warns on alias collisions across plugins", () => {
    const warn = vi.fn();
    const registry = createPluginRegistry({ onAliasCollision: warn });

    registry.register(createPlugin({
      id: "plugin.one",
      panels: [
        {
          id: "panel.one",
          name: "One",
          aliases: ["common"],
          capabilities: ["apps.search"],
          matcher: () => ({ matches: true, commandQuery: "" }),
          component: () => null,
        },
      ],
    }));

    registry.register(createPlugin({
      id: "plugin.two",
      panels: [
        {
          id: "panel.two",
          name: "Two",
          aliases: ["common"],
          capabilities: ["apps.search"],
          matcher: () => ({ matches: true, commandQuery: "" }),
          component: () => null,
        },
      ],
    }));

    expect(warn).toHaveBeenCalledTimes(1);
  });
});
