import { describe, expect, it, vi } from "vitest";
import { createPluginRegistry } from "@/lib/plugin-registry";
import type { CorePluginDescriptor } from "@/lib/plugin-contract";
import type { ShortcutCommandDescriptor } from "@/lib/panel-contract";

function makeCommand(overrides: Partial<ShortcutCommandDescriptor> = {}): ShortcutCommandDescriptor {
  return {
    id: "command.alpha",
    name: "Alpha Command",
    aliases: ["alpha run"],
    capabilities: ["apps.search"],
    matcher: () => ({ matches: true, commandQuery: "" }),
    execute: async () => undefined,
    ...overrides,
  };
}

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
    commands: [],
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

  it("registers commands and tags command pluginId", () => {
    const registry = createPluginRegistry();
    const plugin = createPlugin({
      commands: [makeCommand()],
    });

    registry.register(plugin);

    const commands = registry.listCommands();
    expect(commands).toHaveLength(1);
    expect(commands[0]?.pluginId).toBe("plugin.alpha");
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

  it("rejects command capabilities outside plugin permissions", () => {
    const registry = createPluginRegistry();

    expect(() => {
      registry.register(
        createPlugin({
          permissions: ["apps.search"],
          commands: [makeCommand({ capabilities: ["apps.launch"] })],
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

  it("warns on alias collisions between panels and commands", () => {
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
      commands: [],
    }));

    registry.register(createPlugin({
      id: "plugin.two",
      commands: [makeCommand({ id: "command.two", aliases: ["common"] })],
    }));

    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("registers plugin settings schema", () => {
    const registry = createPluginRegistry();

    registry.register(
      createPlugin({
        settings: [
          {
            key: "feature.enabled",
            label: "Feature Enabled",
            valueType: "boolean",
            defaultValue: true,
          },
        ],
      }),
    );

    expect(registry.listPluginSettings()).toEqual([
      {
        pluginId: "plugin.alpha",
        pluginName: "Alpha",
        definitions: [
          {
            key: "feature.enabled",
            label: "Feature Enabled",
            valueType: "boolean",
            defaultValue: true,
          },
        ],
      },
    ]);
  });

  it("rejects duplicate config keys in the same plugin", () => {
    const registry = createPluginRegistry();

    expect(() => {
      registry.register(
        createPlugin({
          settings: [
            { key: "same", label: "One", valueType: "string" },
            { key: "same", label: "Two", valueType: "number" },
          ],
        }),
      );
    }).toThrow(/duplicate config key/i);
  });

  it("rejects empty select options", () => {
    const registry = createPluginRegistry();

    expect(() => {
      registry.register(
        createPlugin({
          settings: [
            {
              key: "choice",
              label: "Choice",
              valueType: {
                kind: "select",
                options: [],
              },
            },
          ],
        }),
      );
    }).toThrow(/at least one select option/i);
  });
});
