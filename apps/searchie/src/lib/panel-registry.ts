import * as React from "react";
import type { PanelResolution, ShortcutPanelDescriptor } from "@/lib/panel-contract";

type PanelRegistryOptions = {
  onAliasCollision?: (message: string) => void;
};

type InternalEntry = {
  descriptor: ShortcutPanelDescriptor;
  order: number;
};

export type PanelRegistry = {
  register: (descriptor: ShortcutPanelDescriptor) => void;
  find: (query: string) => PanelResolution | null;
  list: () => ShortcutPanelDescriptor[];
};

export function createPanelRegistry(options?: PanelRegistryOptions): PanelRegistry {
  const entries: InternalEntry[] = [];

  return {
    register(descriptor) {
      const duplicate = entries.find((entry) => entry.descriptor.id === descriptor.id);
      if (duplicate) {
        throw new Error(`Panel with id \"${descriptor.id}\" is already registered.`);
      }

      const normalizedAliases = descriptor.aliases.map((alias) => alias.trim().toLowerCase());
      for (const alias of normalizedAliases) {
        if (!alias) continue;
        const collision = entries.find((entry) =>
          entry.descriptor.aliases.some((existing) => existing.trim().toLowerCase() === alias),
        );
        if (collision && options?.onAliasCollision) {
          options.onAliasCollision(
            `Alias collision on \"${alias}\" between panels \"${collision.descriptor.id}\" and \"${descriptor.id}\".`,
          );
        }
      }

      entries.push({
        descriptor,
        order: entries.length,
      });
    },

    find(query) {
      const sorted = [...entries].sort((a, b) => {
        const priorityA = a.descriptor.priority ?? 0;
        const priorityB = b.descriptor.priority ?? 0;
        if (priorityA !== priorityB) {
          return priorityB - priorityA;
        }
        return a.order - b.order;
      });

      for (const entry of sorted) {
        const match = entry.descriptor.matcher(query);
        if (match.matches) {
          return {
            panel: entry.descriptor,
            match,
          };
        }
      }

      return null;
    },

    list() {
      return entries.map((entry) => entry.descriptor);
    },
  };
}

export const PanelRegistryContext = React.createContext<PanelRegistry | null>(null);

export function usePanelRegistry(): PanelRegistry {
  const context = React.useContext(PanelRegistryContext);
  if (!context) {
    throw new Error("PanelRegistryContext is not provided.");
  }
  return context;
}
