const PANEL_CAPABILITIES = [
  "apps.list",
  "apps.search",
  "apps.launch",
  "apps.launchAdmin",
  "apps.uninstall",
  "apps.properties",
  "apps.location",
  "apps.icon",
  "clipboard.search",
  "clipboard.clear",
  "clipboard.pin",
  "clipboard.delete",
  "files.search",
  "files.open",
  "settings.read",
  "settings.write",
  "window.mode",
  "window.shell",
  "system.media",
  "system.volume",
  "system.brightness",
  "system.wifi",
  "system.bluetooth",
  "system.airplane",
  "system.power",
  "system.hotspot",
  "system.settings",
] as const;

const PANEL_ACTIVATION_MODES = ["immediate", "result-item"] as const;

type PanelCapability = (typeof PANEL_CAPABILITIES)[number];
type PanelActivationMode = (typeof PANEL_ACTIVATION_MODES)[number];

export type PluginManifestCommand = {
  id: string;
  name: string;
  title?: string;
  description?: string;
  mode: "panel";
  entry: string;
  aliases: string[];
  capabilities: PanelCapability[];
  searchIntegration?: {
    activationMode?: PanelActivationMode;
    placeholder?: string;
    exitOnEscape?: boolean;
  };
  shortcuts?: Array<{ keys: string; description: string }>;
};

export type PluginManifest = {
  name: string;
  title?: string;
  description?: string;
  icon?: string;
  author?: string;
  version?: string;
  license?: string;
  categories?: string[];
  platforms?: string[];
  runtimeEntry: string;
  commands: PluginManifestCommand[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertString(value: unknown, path: string): string {
  if (typeof value !== "string") {
    throw new Error(`${path} must be a string.`);
  }

  return value;
}

function assertOptionalString(value: unknown, path: string): string | undefined {
  if (typeof value === "undefined") {
    return undefined;
  }

  return assertString(value, path);
}

function normalizeRelativeFilePath(value: string, pathName: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${pathName} cannot be empty.`);
  }

  if (!normalized.startsWith("./")) {
    throw new Error(`${pathName} must start with './'.`);
  }

  if (normalized.includes("..")) {
    throw new Error(`${pathName} cannot contain '..'.`);
  }

  return normalized;
}

function parseCapabilities(value: unknown, pathName: string): PanelCapability[] {
  if (typeof value === "undefined") {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error(`${pathName} must be an array.`);
  }

  const allowed = new Set<string>(PANEL_CAPABILITIES);
  const result: PanelCapability[] = [];

  for (let index = 0; index < value.length; index += 1) {
    const capability = assertString(value[index], `${pathName}[${index}]`);
    if (!allowed.has(capability)) {
      throw new Error(`${pathName}[${index}] has unsupported capability '${capability}'.`);
    }

    result.push(capability as PanelCapability);
  }

  return result;
}

function parseAliases(value: unknown, commandName: string, pathName: string): string[] {
  if (typeof value === "undefined") {
    const fallback = commandName.trim().toLowerCase();
    return fallback ? [fallback] : [];
  }

  if (!Array.isArray(value)) {
    throw new Error(`${pathName} must be an array.`);
  }

  const aliases = value
    .map((entry, index) => assertString(entry, `${pathName}[${index}]`).trim().toLowerCase())
    .filter(Boolean);

  if (aliases.length === 0) {
    throw new Error(`${pathName} must include at least one alias.`);
  }

  return Array.from(new Set(aliases));
}

function parseShortcuts(value: unknown, pathName: string): Array<{ keys: string; description: string }> | undefined {
  if (typeof value === "undefined") {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new Error(`${pathName} must be an array.`);
  }

  return value.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new Error(`${pathName}[${index}] must be an object.`);
    }

    const keys = assertString(entry.keys, `${pathName}[${index}].keys`).trim();
    const description = assertString(entry.description, `${pathName}[${index}].description`).trim();

    if (!keys || !description) {
      throw new Error(`${pathName}[${index}] keys/description cannot be empty.`);
    }

    return { keys, description };
  });
}

function parseSearchIntegration(
  value: unknown,
  pathName: string,
): PluginManifestCommand["searchIntegration"] {
  if (typeof value === "undefined") {
    return undefined;
  }

  if (!isRecord(value)) {
    throw new Error(`${pathName} must be an object.`);
  }

  const activationModeRaw = value.activationMode;
  let activationMode: PanelActivationMode | undefined;
  if (typeof activationModeRaw !== "undefined") {
    const mode = assertString(activationModeRaw, `${pathName}.activationMode`);
    if (!PANEL_ACTIVATION_MODES.includes(mode as PanelActivationMode)) {
      throw new Error(`${pathName}.activationMode has unsupported value '${mode}'.`);
    }
    activationMode = mode as PanelActivationMode;
  }

  const placeholder = assertOptionalString(value.placeholder, `${pathName}.placeholder`);
  const exitOnEscapeRaw = value.exitOnEscape;
  if (typeof exitOnEscapeRaw !== "undefined" && typeof exitOnEscapeRaw !== "boolean") {
    throw new Error(`${pathName}.exitOnEscape must be a boolean.`);
  }

  return {
    activationMode,
    placeholder,
    exitOnEscape: exitOnEscapeRaw as boolean | undefined,
  };
}

function parseCommand(value: unknown, index: number): PluginManifestCommand {
  const pathName = `manifest.commands[${index}]`;
  if (!isRecord(value)) {
    throw new Error(`${pathName} must be an object.`);
  }

  const id = assertString(value.id, `${pathName}.id`).trim();
  const name = assertString(value.name, `${pathName}.name`).trim();
  const mode = (assertOptionalString(value.mode, `${pathName}.mode`) ?? "panel").trim().toLowerCase();

  if (!id) {
    throw new Error(`${pathName}.id cannot be empty.`);
  }

  if (!name) {
    throw new Error(`${pathName}.name cannot be empty.`);
  }

  if (mode !== "panel") {
    throw new Error(`${pathName}.mode must be 'panel' for current runtime support.`);
  }

  const entryRaw = assertString(value.entry, `${pathName}.entry`);

  return {
    id,
    name,
    title: assertOptionalString(value.title, `${pathName}.title`),
    description: assertOptionalString(value.description, `${pathName}.description`),
    mode: "panel",
    entry: normalizeRelativeFilePath(entryRaw, `${pathName}.entry`),
    aliases: parseAliases(value.aliases, name, `${pathName}.aliases`),
    capabilities: parseCapabilities(value.capabilities, `${pathName}.capabilities`),
    searchIntegration: parseSearchIntegration(value.searchIntegration, `${pathName}.searchIntegration`),
    shortcuts: parseShortcuts(value.shortcuts, `${pathName}.shortcuts`),
  };
}

export function validateManifest(input: unknown): PluginManifest {
  if (!isRecord(input)) {
    throw new Error("manifest must be a JSON object.");
  }

  const name = assertString(input.name, "manifest.name").trim();
  if (!name) {
    throw new Error("manifest.name cannot be empty.");
  }

  const commandsRaw = input.commands;
  if (!Array.isArray(commandsRaw) || commandsRaw.length === 0) {
    throw new Error("manifest.commands must include at least one command.");
  }

  const commands = commandsRaw.map((command, index) => parseCommand(command, index));

  const commandIds = new Set<string>();
  for (const command of commands) {
    if (commandIds.has(command.id)) {
      throw new Error(`manifest.commands has duplicate id '${command.id}'.`);
    }
    commandIds.add(command.id);
  }

  const runtimeEntryRaw =
    typeof input.runtimeEntry === "string" && input.runtimeEntry.trim().length > 0
      ? input.runtimeEntry
      : "./dist/runtime.js";

  return {
    name,
    title: assertOptionalString(input.title, "manifest.title"),
    description: assertOptionalString(input.description, "manifest.description"),
    icon: assertOptionalString(input.icon, "manifest.icon"),
    author: assertOptionalString(input.author, "manifest.author"),
    version: assertOptionalString(input.version, "manifest.version"),
    license: assertOptionalString(input.license, "manifest.license"),
    categories: Array.isArray(input.categories)
      ? input.categories.map((entry, index) => assertString(entry, `manifest.categories[${index}]`))
      : undefined,
    platforms: Array.isArray(input.platforms)
      ? input.platforms.map((entry, index) => assertString(entry, `manifest.platforms[${index}]`))
      : undefined,
    runtimeEntry: normalizeRelativeFilePath(runtimeEntryRaw, "manifest.runtimeEntry"),
    commands,
  };
}
