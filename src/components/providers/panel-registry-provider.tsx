import * as React from "react";
import { createPanelRegistry, PanelRegistryContext } from "@/lib/panel-registry";
import { createPluginRegistry } from "@/lib/plugin-registry";
import { buildCorePlugins } from "@/plugins/core";

type PanelRegistryProviderProps = {
  children: React.ReactNode;
};

export function PanelRegistryProvider({ children }: PanelRegistryProviderProps) {
  const [registry] = React.useState(() => {
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

    return nextRegistry;
  });

  return <PanelRegistryContext.Provider value={registry}>{children}</PanelRegistryContext.Provider>;
}
