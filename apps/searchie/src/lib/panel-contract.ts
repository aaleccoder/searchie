import * as React from "react";

export type PanelCapability =
  | "apps.list"
  | "apps.search"
  | "apps.launch"
  | "apps.launchAdmin"
  | "apps.uninstall"
  | "apps.properties"
  | "apps.location"
  | "apps.icon"
  | "clipboard.search"
  | "clipboard.clear"
  | "clipboard.pin"
  | "clipboard.delete"
  | "files.search"
  | "files.open"
  | "settings.read"
  | "settings.write"
  | "window.mode"
  | "window.shell"
  | "system.media"
  | "system.volume"
  | "system.brightness"
  | "system.wifi"
  | "system.bluetooth"
  | "system.airplane"
  | "system.power"
  | "system.hotspot"
  | "system.settings";

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

export type ShortcutCommandExecute = (
  context: ShortcutCommandExecutionContext,
) => void | Promise<void>;

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

export type PanelResolution = {
  panel: ShortcutPanelDescriptor;
  match: PanelMatcherResult;
};

export type ShortcutCommandResolution = {
  command: ShortcutCommandDescriptor;
  match: PanelMatcherResult;
};
