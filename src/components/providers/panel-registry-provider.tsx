import * as React from "react";
import { CommandRegistryContext, createCommandRegistry } from "@/lib/command-registry";
import { createPanelRegistry, PanelRegistryContext } from "@/lib/panel-registry";
import { createPluginRegistry, type PluginRegistry } from "@/lib/plugin-registry";
import { buildCorePlugins } from "@/plugins/core";
import { loadRuntimePlugins } from "@/plugins/runtime";

type PanelRegistryProviderProps = {
  children: React.ReactNode;
};

const PluginRegistryContext = React.createContext<PluginRegistry | null>(null);

export function usePluginRegistry(): PluginRegistry {
  const context = React.useContext(PluginRegistryContext);
  if (!context) {
    throw new Error("PluginRegistryContext is not provided.");
  }

  return context;
}

export function PanelRegistryProvider({ children }: PanelRegistryProviderProps) {
  const [state] = React.useState(() => {
    const pluginRegistry = createPluginRegistry({
      onAliasCollision: (message) => {
        console.warn(message);
      },
    });

    for (const plugin of buildCorePlugins()) {
      pluginRegistry.register(plugin);
    }

    const nextRegistry = createPanelRegistry({
      onAliasCollision: (message) => {
        console.warn(message);
      },
    });

    const nextCommandRegistry = createCommandRegistry({
      onAliasCollision: (message) => {
        console.warn(message);
      },
    });

    for (const panel of pluginRegistry.listPanels()) {
      nextRegistry.register(panel);
    }

    for (const command of pluginRegistry.listCommands()) {
      nextCommandRegistry.register(command);
    }

    return {
      panelRegistry: nextRegistry,
      commandRegistry: nextCommandRegistry,
      pluginRegistry,
    };
  });

  const [, setRuntimeRevision] = React.useState(0);

  React.useEffect(() => {
    let disposed = false;

    async function registerRuntimePlugins() {
      const runtimePlugins = await loadRuntimePlugins();
      if (disposed) {
        return;
      }

      for (const plugin of runtimePlugins) {
        try {
          state.pluginRegistry.register(plugin);
          for (const panel of plugin.panels) {
            state.panelRegistry.register(panel);
          }
          for (const command of plugin.commands ?? []) {
            state.commandRegistry.register(command);
          }
        } catch (error) {
          console.warn("Failed to register runtime plugin", plugin.id, error);
        }
      }

      setRuntimeRevision((value) => value + 1);
    }

    registerRuntimePlugins();

    return () => {
      disposed = true;
    };
  }, [state]);

  return (
    <PluginRegistryContext.Provider value={state.pluginRegistry}>
      <CommandRegistryContext.Provider value={state.commandRegistry}>
        <PanelRegistryContext.Provider value={state.panelRegistry}>{children}</PanelRegistryContext.Provider>
      </CommandRegistryContext.Provider>
    </PluginRegistryContext.Provider>
  );
}
