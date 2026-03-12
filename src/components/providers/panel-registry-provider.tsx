import * as React from "react";
import { CommandRegistryContext, createCommandRegistry } from "@/lib/command-registry";
import { createPanelRegistry, PanelRegistryContext } from "@/lib/panel-registry";
import { createPluginRegistry, type PluginRegistry } from "@/lib/plugin-registry";
import { buildCorePlugins } from "@/plugins/core";

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

  return (
    <PluginRegistryContext.Provider value={state.pluginRegistry}>
      <CommandRegistryContext.Provider value={state.commandRegistry}>
        <PanelRegistryContext.Provider value={state.panelRegistry}>{children}</PanelRegistryContext.Provider>
      </CommandRegistryContext.Provider>
    </PluginRegistryContext.Provider>
  );
}
