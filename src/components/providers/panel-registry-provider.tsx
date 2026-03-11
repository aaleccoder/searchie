import * as React from "react";
import { buildAppsPanels } from "@/components/panels/apps";
import { clipboardShortcutPanel } from "@/components/panels/clipboard-shortcut-panel";
import { buildUtilityPanels } from "@/components/panels/utilities";
import { createPanelRegistry, PanelRegistryContext } from "@/lib/panel-registry";

type PanelRegistryProviderProps = {
  children: React.ReactNode;
};

export function PanelRegistryProvider({ children }: PanelRegistryProviderProps) {
  const [registry] = React.useState(() => {
    const nextRegistry = createPanelRegistry({
      onAliasCollision: (message) => {
        console.warn(message);
      },
    });

    nextRegistry.register(clipboardShortcutPanel);
    for (const appsPanel of buildAppsPanels()) {
      nextRegistry.register(appsPanel);
    }
    for (const utilityPanel of buildUtilityPanels()) {
      nextRegistry.register(utilityPanel);
    }
    return nextRegistry;
  });

  return <PanelRegistryContext.Provider value={registry}>{children}</PanelRegistryContext.Provider>;
}
