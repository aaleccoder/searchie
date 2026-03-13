import * as React from "react";
import { listen } from "@tauri-apps/api/event";
import { CommandRegistryContext, createCommandRegistry } from "@/lib/command-registry";
import { createPanelRegistry, PanelRegistryContext } from "@/lib/panel-registry";
import { createPluginRegistry, type PluginRegistry } from "@/lib/plugin-registry";
import type { CorePluginDescriptor } from "@/lib/plugin-contract";
import { loadRuntimePlugins } from "@/lib/runtime-plugin-loader";
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
  const buildState = React.useCallback((runtimePlugins: CorePluginDescriptor[] = []) => {
    const pluginRegistry = createPluginRegistry({
      onAliasCollision: (message) => {
        console.warn(message);
      },
    });

    for (const plugin of buildCorePlugins()) {
      pluginRegistry.register(plugin);
    }

    for (const runtimePlugin of runtimePlugins) {
      try {
        pluginRegistry.register(runtimePlugin);
      } catch (error) {
        console.error("[runtime-plugin-loader] failed to register runtime plugin:", error);
      }
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
  }, []);

  const [state, setState] = React.useState(() => buildState());

  React.useEffect(() => {
    let cancelled = false;
    let unlistenRuntimePlugins: undefined | (() => void);

    const load = async () => {
      try {
        const runtimePlugins = await loadRuntimePlugins();
        if (!cancelled) {
          setState(buildState(runtimePlugins));
        }
      } catch (error) {
        console.error("[runtime-plugin-loader] failed loading runtime plugins:", error);
      }
    };

    void load();

    const onRuntimePluginsUpdated = () => {
      void load();
    };

    window.addEventListener("runtime-plugins-updated", onRuntimePluginsUpdated);

    void (async () => {
      try {
        unlistenRuntimePlugins = await listen("searchie://runtime-plugins-updated", () => {
          void load();
        });
      } catch (error) {
        console.error("[runtime-plugin-loader] failed listening runtime updates:", error);
      }
    })();

    return () => {
      cancelled = true;
      window.removeEventListener("runtime-plugins-updated", onRuntimePluginsUpdated);
      unlistenRuntimePlugins?.();
    };
  }, [buildState]);

  return (
    <PluginRegistryContext.Provider value={state.pluginRegistry}>
      <CommandRegistryContext.Provider value={state.commandRegistry}>
        <PanelRegistryContext.Provider value={state.panelRegistry}>{children}</PanelRegistryContext.Provider>
      </CommandRegistryContext.Provider>
    </PluginRegistryContext.Provider>
  );
}
