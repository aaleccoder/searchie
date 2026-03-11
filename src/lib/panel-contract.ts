import * as React from "react";

export type PanelCapability =
  | "apps.list"
  | "apps.search"
  | "apps.launch"
  | "apps.icon"
  | "clipboard.search"
  | "clipboard.clear"
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
};

export type ShortcutPanelDescriptor = {
  id: string;
  name: string;
  aliases: string[];
  capabilities: PanelCapability[];
  matcher: PanelMatcher;
  component: React.ComponentType<PanelRenderProps>;
  priority?: number;
};

export type PanelResolution = {
  panel: ShortcutPanelDescriptor;
  match: PanelMatcherResult;
};
