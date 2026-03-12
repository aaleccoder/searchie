import type { PanelFooterConfig, ShortcutCommandDescriptor, ShortcutPanelDescriptor } from "@/lib/panel-contract";

export type InstalledApp = {
  id: string;
  name: string;
  launchPath: string;
  launchArgs: string[];
  iconPath?: string | null;
  version?: string | null;
  publisher?: string | null;
  installLocation?: string | null;
  uninstallCommand?: string | null;
  source: string;
};

export type AppActionItem = {
  id: "open" | "run-as-admin" | "uninstall" | "properties" | "open-location";
  label: string;
  hint: string;
  disabled?: boolean;
};

export type AppsLauncherPanelProps = {
  commandQuery: string;
  registerInputArrowDownHandler?: ((handler: (() => boolean | void) | null) => void) | undefined;
  registerInputEnterHandler?: ((handler: (() => boolean | void) | null) => void) | undefined;
  registerPanelFooter?: ((footer: PanelFooterConfig | null) => void) | undefined;
  focusLauncherInput?: (() => void) | undefined;
  clearLauncherInput?: (() => void) | undefined;
  closeLauncherWindow?: (() => void) | undefined;
  activatePanelSession?: ((panel: ShortcutPanelDescriptor, nextQuery: string) => void) | undefined;
};

export type PanelCommandSuggestion = {
  id: string;
  panel: ShortcutPanelDescriptor;
  commandQuery: string;
  label: string;
};

export type DirectCommandSuggestion = {
  id: string;
  command: ShortcutCommandDescriptor;
  commandQuery: string;
  label: string;
};

export type NavigationItem =
  | {
      id: string;
      kind: "app";
      app: InstalledApp;
    }
  | {
      id: string;
      kind: "panel-command";
      command: PanelCommandSuggestion;
    }
  | {
      id: string;
      kind: "direct-command";
      command: DirectCommandSuggestion;
    };

export type NavigationMode = "list" | "actions";
