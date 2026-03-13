import type * as React from "react";
import type { PanelCapability } from "./commands";

export type PluginPermission = PanelCapability;

export type PluginConfigOption = {
  label: string;
  value: string;
};

export type PluginConfigValueType =
  | "boolean"
  | "string"
  | "number"
  | {
      kind: "select";
      options: PluginConfigOption[];
    };

export type PluginConfigValue = boolean | string | number;

export type PluginConfigDefinition = {
  key: string;
  label: string;
  description?: string;
  optional?: boolean;
  valueType: PluginConfigValueType;
  defaultValue?: PluginConfigValue;
};

export type PanelMatcherResult = {
  matches: boolean;
  commandQuery: string;
};

export type PanelMatcher = (query: string) => PanelMatcherResult;

export type ShortcutCommandRenderContext = {
  rawQuery: string;
  commandQuery: string;
};

export type ShortcutCommandExecutionContext = ShortcutCommandRenderContext & {
  source: "launcher" | "apps";
  clearLauncherInput?: (() => void) | undefined;
  closeLauncherWindow?: (() => void) | undefined;
  focusLauncherInput?: (() => void) | undefined;
};

export type ShortcutCommandExecute = (context: ShortcutCommandExecutionContext) => void | Promise<void>;

export type PanelRenderProps = {
  commandQuery: string;
  rawQuery: string;
  registerInputArrowDownHandler?: ((handler: (() => boolean | void) | null) => void) | undefined;
  registerInputEnterHandler?: ((handler: (() => boolean | void) | null) => void) | undefined;
  registerPanelFooter?: ((footer: PanelFooterConfig | null) => void) | undefined;
  focusLauncherInput?: (() => void) | undefined;
  clearLauncherInput?: (() => void) | undefined;
  closeLauncherWindow?: (() => void) | undefined;
  activatePanelSession?: ((panel: ShortcutPanelDescriptor, nextQuery: string) => void) | undefined;
};

export type PanelFooterAction = {
  id: string;
  label: string;
  onSelect: () => void | Promise<void>;
  icon?: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
  loading?: boolean;
  destructive?: boolean;
  shortcutHint?: string;
};

export type PanelFooterMeta = {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
};

export type PanelFooterControls = {
  openExtraActions: () => void;
  closeExtraActions: () => void;
  toggleExtraActions: () => void;
  runPrimaryAction: () => boolean;
  runExtraActionById: (actionId: string) => boolean;
};

export type PanelFooterConfig = {
  panel?: PanelFooterMeta;
  primaryAction?: PanelFooterAction;
  extraActions?: PanelFooterAction[];
  helperText?: string;
  registerControls?: ((controls: PanelFooterControls | null) => void) | undefined;
};

export type PanelInputKeyDownHandler = (
  event: React.KeyboardEvent<HTMLInputElement>,
  context: {
    rawQuery: string;
    commandQuery: string;
  },
) => boolean | void;

export type PanelSearchIntegration = {
  activateOnEnter?: boolean;
  activationMode?: "immediate" | "result-item";
  placeholder?: string;
  exitOnEscape?: boolean;
};

export type PanelAppsLauncherIntegration = {
  injectAsApp?: boolean;
};

export type CommandAppsLauncherIntegration = {
  injectAsApp?: boolean;
};

export type PanelShortcutHint = {
  keys: string;
  description: string;
};

export type ShortcutPanelDescriptor = {
  pluginId?: string;
  id: string;
  name: string;
  aliases: string[];
  isDefault?: boolean;
  capabilities: PanelCapability[];
  matcher: PanelMatcher;
  component: React.ComponentType<PanelRenderProps>;
  commandIcon?: React.ComponentType<{ className?: string }>;
  shortcuts?: PanelShortcutHint[];
  onInputKeyDown?: PanelInputKeyDownHandler;
  searchIntegration?: PanelSearchIntegration;
  appsLauncherIntegration?: PanelAppsLauncherIntegration;
  priority?: number;
};

export type ShortcutCommandDescriptor = {
  pluginId?: string;
  id: string;
  name: string;
  aliases: string[];
  capabilities: PanelCapability[];
  matcher: PanelMatcher;
  execute: ShortcutCommandExecute;
  commandIcon?: React.ComponentType<{ className?: string }>;
  getLabel?: ((context: ShortcutCommandRenderContext) => string) | undefined;
  appsLauncherIntegration?: CommandAppsLauncherIntegration;
  priority?: number;
};

export type CorePluginDescriptor = {
  id: string;
  name: string;
  version: string;
  permissions: PluginPermission[];
  panels: ShortcutPanelDescriptor[];
  commands?: ShortcutCommandDescriptor[];
  settings?: PluginConfigDefinition[];
};

type DefineConfigOptions = {
  label?: string;
  description?: string;
  defaultValue?: PluginConfigValue;
};

type DefineConfig = (
  key: string,
  valueType: PluginConfigValueType,
  optional?: boolean,
  options?: DefineConfigOptions,
) => PluginConfigDefinition;

type CorePluginWithSettingsBuilder = Omit<CorePluginDescriptor, "settings"> & {
  settings?: PluginConfigDefinition[] | ((defineConfig: DefineConfig) => PluginConfigDefinition[]);
};

export function definePluginPanel(descriptor: ShortcutPanelDescriptor): ShortcutPanelDescriptor {
  return descriptor;
}

export function definePluginCommand(descriptor: ShortcutCommandDescriptor): ShortcutCommandDescriptor {
  return descriptor;
}

function createDefineConfig(): DefineConfig {
  return (key, valueType, optional = false, options) => ({
    key,
    valueType,
    optional,
    label: options?.label ?? key,
    description: options?.description,
    defaultValue: options?.defaultValue,
  });
}

export function defineCorePlugin(descriptor: CorePluginWithSettingsBuilder): CorePluginDescriptor {
  const defineConfig = createDefineConfig();
  const settings =
    typeof descriptor.settings === "function" ? descriptor.settings(defineConfig) : (descriptor.settings ?? []);

  return {
    ...descriptor,
    settings,
  };
}
