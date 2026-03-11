import * as React from "react";
import { clipboardShortcutPanel } from "@/components/panels/clipboard-shortcut-panel";
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
    return nextRegistry;
  });

  return <PanelRegistryContext.Provider value={registry}>{children}</PanelRegistryContext.Provider>;
}
