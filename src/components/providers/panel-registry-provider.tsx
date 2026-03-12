import * as React from "react";
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

    for (const panel of pluginRegistry.listPanels()) {
      nextRegistry.register(panel);
    }

    return {
      panelRegistry: nextRegistry,
      pluginRegistry,
    };
  });

  return (
    <PluginRegistryContext.Provider value={state.pluginRegistry}>
      <PanelRegistryContext.Provider value={state.panelRegistry}>{children}</PanelRegistryContext.Provider>
    </PluginRegistryContext.Provider>
  );
}
