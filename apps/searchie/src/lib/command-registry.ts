import * as React from "react";
import type { ShortcutCommandDescriptor, ShortcutCommandResolution } from "@/lib/panel-contract";

type CommandRegistryOptions = {
  onAliasCollision?: (message: string) => void;
};

type InternalEntry = {
  descriptor: ShortcutCommandDescriptor;
  order: number;
};

export type CommandRegistry = {
  register: (descriptor: ShortcutCommandDescriptor) => void;
  find: (query: string) => ShortcutCommandResolution | null;
  list: () => ShortcutCommandDescriptor[];
};

export function createCommandRegistry(options?: CommandRegistryOptions): CommandRegistry {
  const entries: InternalEntry[] = [];

  return {
    register(descriptor) {
      const duplicate = entries.find((entry) => entry.descriptor.id === descriptor.id);
      if (duplicate) {
        throw new Error(`Command with id "${descriptor.id}" is already registered.`);
      }

      const normalizedAliases = descriptor.aliases.map((alias) => alias.trim().toLowerCase());
      for (const alias of normalizedAliases) {
        if (!alias) continue;
        const collision = entries.find((entry) =>
          entry.descriptor.aliases.some((existing) => existing.trim().toLowerCase() === alias),
        );
        if (collision && options?.onAliasCollision) {
          options.onAliasCollision(
            `Alias collision on "${alias}" between commands "${collision.descriptor.id}" and "${descriptor.id}".`,
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
            command: entry.descriptor,
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

export const CommandRegistryContext = React.createContext<CommandRegistry | null>(null);

export function useCommandRegistry(): CommandRegistry {
  const context = React.useContext(CommandRegistryContext);
  if (!context) {
    throw new Error("CommandRegistryContext is not provided.");
  }
  return context;
}