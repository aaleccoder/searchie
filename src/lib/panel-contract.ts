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
  | "files.search"
  | "files.open"
  | "settings.read"
  | "settings.write"
  | "window.mode";

export type PanelMatcherResult = {
  matches: boolean;
  commandQuery: string;
};

export type PanelMatcher = (query: string) => PanelMatcherResult;

export type PanelRenderProps = {
  commandQuery: string;
  rawQuery: string;
  registerInputArrowDownHandler?: ((handler: (() => boolean | void) | null) => void) | undefined;
  focusLauncherInput?: (() => void) | undefined;
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

export type ShortcutPanelDescriptor = {
  id: string;
  name: string;
  aliases: string[];
  capabilities: PanelCapability[];
  matcher: PanelMatcher;
  component: React.ComponentType<PanelRenderProps>;
  commandIcon?: React.ComponentType<{ className?: string }>;
  onInputKeyDown?: PanelInputKeyDownHandler;
  searchIntegration?: PanelSearchIntegration;
  priority?: number;
};

export type PanelResolution = {
  panel: ShortcutPanelDescriptor;
  match: PanelMatcherResult;
};
