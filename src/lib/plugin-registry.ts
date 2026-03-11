import type { ShortcutPanelDescriptor } from "@/lib/panel-contract";
import type { CorePluginDescriptor } from "@/lib/plugin-contract";

type PluginRegistryOptions = {
  onAliasCollision?: (message: string) => void;
};

export type PluginRegistry = {
  register: (plugin: CorePluginDescriptor) => void;
  listPlugins: () => CorePluginDescriptor[];
  listPanels: () => ShortcutPanelDescriptor[];
};

export function createPluginRegistry(options?: PluginRegistryOptions): PluginRegistry {
  const plugins: CorePluginDescriptor[] = [];

  return {
    register(plugin) {
      const duplicatePlugin = plugins.find((entry) => entry.id === plugin.id);
      if (duplicatePlugin) {
        throw new Error(`Plugin with id "${plugin.id}" is already registered.`);
      }

      const panelIds = new Set<string>();
      const seenAliases = new Map<string, string>();

      for (const existingPlugin of plugins) {
        for (const panel of existingPlugin.panels) {
          panelIds.add(panel.id);
          for (const alias of panel.aliases) {
            const normalized = alias.trim().toLowerCase();
            if (normalized) {
              seenAliases.set(normalized, panel.id);
            }
          }
        }
      }

      const permissions = new Set(plugin.permissions);
      const normalizedPanels = plugin.panels.map((panel) => {
        if (panelIds.has(panel.id)) {
          throw new Error(`Panel with id "${panel.id}" is already registered by another plugin.`);
        }

        for (const capability of panel.capabilities) {
          if (!permissions.has(capability)) {
            throw new Error(
              `Panel "${panel.id}" declares capability "${capability}" which is not allowed by plugin "${plugin.id}" permissions.`,
            );
          }
        }

        for (const alias of panel.aliases) {
          const normalizedAlias = alias.trim().toLowerCase();
          if (!normalizedAlias) {
            continue;
          }

          const existingPanelId = seenAliases.get(normalizedAlias);
          if (existingPanelId && options?.onAliasCollision) {
            options.onAliasCollision(
              `Alias collision on "${normalizedAlias}" between panels "${existingPanelId}" and "${panel.id}".`,
            );
          }

          seenAliases.set(normalizedAlias, panel.id);
        }

        panelIds.add(panel.id);
        return {
          ...panel,
          pluginId: plugin.id,
        };
      });

      plugins.push({
        ...plugin,
        panels: normalizedPanels,
      });
    },

    listPlugins() {
      return [...plugins];
    },

    listPanels() {
      return plugins.flatMap((plugin) => plugin.panels);
    },
  };
}
