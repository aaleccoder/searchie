import { load } from "@tauri-apps/plugin-store";
import type {
  PluginConfigDefinition,
  PluginConfigOption,
  PluginConfigValue,
  PluginConfigValueType,
} from "@/lib/plugin-contract";

type PluginConfigSnapshot = Record<string, PluginConfigValue>;

const definitionRegistry = new Map<string, Map<string, PluginConfigDefinition>>();

function normalizePluginId(pluginId: string): string {
  return pluginId.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "_");
}

function getSelectOptions(valueType: PluginConfigValueType): PluginConfigOption[] {
  if (typeof valueType === "string") {
    return [];
  }

  return [...valueType.options];
}

function getDefaultValue(definition: PluginConfigDefinition): PluginConfigValue | undefined {
  if (definition.defaultValue !== undefined) {
    return definition.defaultValue;
  }

  if (definition.optional) {
    return undefined;
  }

  if (definition.valueType === "boolean") {
    return false;
  }

  if (definition.valueType === "number") {
    return 0;
  }

  if (definition.valueType === "string") {
    return "";
  }

  return definition.valueType.options[0]?.value ?? "";
}

function assertAllowedType(valueType: PluginConfigValueType, value: PluginConfigValue): void {
  if (valueType === "boolean") {
    if (typeof value !== "boolean") {
      throw new Error("Expected a boolean value.");
    }
    return;
  }

  if (valueType === "number") {
    if (typeof value !== "number" || Number.isNaN(value)) {
      throw new Error("Expected a numeric value.");
    }
    return;
  }

  if (valueType === "string") {
    if (typeof value !== "string") {
      throw new Error("Expected a string value.");
    }
    return;
  }

  if (typeof value !== "string") {
    throw new Error("Expected a select option string value.");
  }

  const options = getSelectOptions(valueType);
  if (!options.some((option) => option.value === value)) {
    throw new Error(`Value "${value}" is not a valid select option.`);
  }
}

function getDefinitions(pluginId: string): Map<string, PluginConfigDefinition> {
  const definitions = definitionRegistry.get(pluginId);
  if (!definitions) {
    throw new Error(`Plugin "${pluginId}" has no registered configuration schema.`);
  }

  return definitions;
}

async function loadStore(pluginId: string) {
  return load(getPluginConfigStoreFile(pluginId));
}

export function getPluginConfigStoreFile(pluginId: string): string {
  return `plugin-config.${normalizePluginId(pluginId)}.json`;
}

export function registerPluginConfigDefinitions(pluginId: string, definitions: PluginConfigDefinition[]): void {
  definitionRegistry.set(pluginId, new Map(definitions.map((definition) => [definition.key, definition])));
}

export function listPluginConfigDefinitions(pluginId: string): PluginConfigDefinition[] {
  return [...getDefinitions(pluginId).values()];
}

export async function ensurePluginConfigDefaults(pluginId: string): Promise<void> {
  const store = await loadStore(pluginId);
  const definitions = getDefinitions(pluginId);

  let shouldSave = false;
  for (const definition of definitions.values()) {
    const value = await store.get<PluginConfigValue>(definition.key);
    if (value !== undefined) {
      continue;
    }

    const fallback = getDefaultValue(definition);
    if (fallback === undefined) {
      continue;
    }

    await store.set(definition.key, fallback);
    shouldSave = true;
  }

  if (shouldSave) {
    await store.save();
  }
}

export async function readPluginConfig(pluginId: string, key: string): Promise<PluginConfigValue | undefined> {
  const definitions = getDefinitions(pluginId);
  if (!definitions.has(key)) {
    throw new Error(`Config key "${key}" is not defined for plugin "${pluginId}".`);
  }

  await ensurePluginConfigDefaults(pluginId);
  const store = await loadStore(pluginId);
  return store.get<PluginConfigValue>(key);
}

export async function writePluginConfig(pluginId: string, key: string, value: PluginConfigValue): Promise<void> {
  const definitions = getDefinitions(pluginId);
  const definition = definitions.get(key);
  if (!definition) {
    throw new Error(`Config key "${key}" is not defined for plugin "${pluginId}".`);
  }

  assertAllowedType(definition.valueType, value);

  const store = await loadStore(pluginId);
  await store.set(key, value);
  await store.save();
}

export async function readPluginConfigSnapshot(pluginId: string): Promise<PluginConfigSnapshot> {
  await ensurePluginConfigDefaults(pluginId);
  const store = await loadStore(pluginId);
  const definitions = getDefinitions(pluginId);
  const snapshot: PluginConfigSnapshot = {};

  for (const definition of definitions.values()) {
    const value = await store.get<PluginConfigValue>(definition.key);
    if (value !== undefined) {
      snapshot[definition.key] = value;
    }
  }

  return snapshot;
}

export function resetPluginConfigRegistryForTests(): void {
  definitionRegistry.clear();
}
