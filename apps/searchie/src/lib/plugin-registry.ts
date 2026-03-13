import type { ShortcutCommandDescriptor, ShortcutPanelDescriptor } from "@/lib/panel-contract";
import type { CorePluginDescriptor, PluginConfigDefinition } from "@/lib/plugin-contract";
import { registerPluginConfigDefinitions } from "@/lib/plugin-config-store";

type PluginRegistryOptions = {
  onAliasCollision?: (message: string) => void;
};

export type PluginRegistry = {
  register: (plugin: CorePluginDescriptor) => void;
  listPlugins: () => CorePluginDescriptor[];
  listPanels: () => ShortcutPanelDescriptor[];
  listCommands: () => ShortcutCommandDescriptor[];
  listPluginSettings: () => Array<{
    pluginId: string;
    pluginName: string;
    definitions: PluginConfigDefinition[];
  }>;
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
      const commandIds = new Set<string>();
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

        for (const command of existingPlugin.commands ?? []) {
          commandIds.add(command.id);
          for (const alias of command.aliases) {
            const normalized = alias.trim().toLowerCase();
            if (normalized) {
              seenAliases.set(normalized, command.id);
            }
          }
        }
      }

      const permissions = new Set(plugin.permissions);
      const configKeys = new Set<string>();
      const normalizedSettings = (plugin.settings ?? []).map((definition) => {
        const key = definition.key.trim();
        if (!key) {
          throw new Error(`Plugin "${plugin.id}" declares an empty config key.`);
        }

        if (configKeys.has(key)) {
          throw new Error(`Plugin "${plugin.id}" declares duplicate config key "${key}".`);
        }

        if (typeof definition.valueType !== "string") {
          if (definition.valueType.kind !== "select") {
            throw new Error(`Plugin "${plugin.id}" config key "${key}" has invalid select metadata.`);
          }

          if (!Array.isArray(definition.valueType.options) || definition.valueType.options.length === 0) {
            throw new Error(`Plugin "${plugin.id}" config key "${key}" must declare at least one select option.`);
          }
        }

        configKeys.add(key);
        return {
          ...definition,
          key,
        };
      });
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

      const normalizedCommands = (plugin.commands ?? []).map((command) => {
        if (commandIds.has(command.id)) {
          throw new Error(`Command with id "${command.id}" is already registered by another plugin.`);
        }

        for (const capability of command.capabilities) {
          if (!permissions.has(capability)) {
            throw new Error(
              `Command "${command.id}" declares capability "${capability}" which is not allowed by plugin "${plugin.id}" permissions.`,
            );
          }
        }

        for (const alias of command.aliases) {
          const normalizedAlias = alias.trim().toLowerCase();
          if (!normalizedAlias) {
            continue;
          }

          const existingEntryId = seenAliases.get(normalizedAlias);
          if (existingEntryId && options?.onAliasCollision) {
            options.onAliasCollision(
              `Alias collision on "${normalizedAlias}" between entries "${existingEntryId}" and "${command.id}".`,
            );
          }

          seenAliases.set(normalizedAlias, command.id);
        }

        commandIds.add(command.id);
        return {
          ...command,
          pluginId: plugin.id,
        };
      });

      plugins.push({
        ...plugin,
        panels: normalizedPanels,
        commands: normalizedCommands,
        settings: normalizedSettings,
      });

      registerPluginConfigDefinitions(plugin.id, normalizedSettings);
    },

    listPlugins() {
      return [...plugins];
    },

    listPanels() {
      return plugins.flatMap((plugin) => plugin.panels);
    },

    listCommands() {
      return plugins.flatMap((plugin) => plugin.commands ?? []);
    },

    listPluginSettings() {
      return plugins
        .map((plugin) => ({
          pluginId: plugin.id,
          pluginName: plugin.name,
          definitions: plugin.settings ?? [],
        }))
        .filter((entry) => entry.definitions.length > 0);
    },
  };
}
