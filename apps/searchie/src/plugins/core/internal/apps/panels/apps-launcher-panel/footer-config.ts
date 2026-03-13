import { FolderOpen, Rocket, Shield, Trash2, Wrench } from "lucide-react";
import type { PanelFooterConfig } from "@/lib/panel-contract";
import type { ShortcutPanelDescriptor } from "@/lib/panel-contract";
import type { AppActionItem, InstalledApp, NavigationItem } from "./types";

type BuildFooterConfigArgs = {
  selectedItem: NavigationItem | null;
  appActions: AppActionItem[];
  busy: boolean;
  busyActionId: AppActionItem["id"] | null;
  registerFooterControls: PanelFooterConfig["registerControls"];
  clearLauncherInput?: (() => void) | undefined;
  activatePanelSession?: ((panel: ShortcutPanelDescriptor, nextQuery: string) => void) | undefined;
  executeAppAction: (actionId: AppActionItem["id"], app: InstalledApp) => Promise<void>;
};

export function buildFooterConfig({
  selectedItem,
  appActions,
  busy,
  busyActionId,
  registerFooterControls,
  clearLauncherInput,
  activatePanelSession,
  executeAppAction,
}: BuildFooterConfigArgs): PanelFooterConfig | null {
  if (!selectedItem) {
    return null;
  }

  if (selectedItem.kind === "panel-command") {
    return {
      panel: {
        title: "Apps",
        icon: Rocket,
      },
      registerControls: registerFooterControls,
      primaryAction: {
        id: "open-panel-command",
        label: `Open ${selectedItem.command.panel.name}`,
        icon: Rocket,
        onSelect: () => {
          clearLauncherInput?.();
          activatePanelSession?.(selectedItem.command.panel, selectedItem.command.commandQuery);
        },
        shortcutHint: "Enter",
      },
    };
  }

  const currentApp = selectedItem.app;
  const extraActions = appActions
    .filter((action) => action.id !== "open")
    .map((action) => ({
      id: action.id,
      label: action.label,
      icon:
        action.id === "run-as-admin"
          ? Shield
          : action.id === "uninstall"
            ? Trash2
            : action.id === "properties"
              ? Wrench
              : FolderOpen,
      shortcutHint:
        action.id === "run-as-admin"
          ? "Alt+R"
          : action.id === "uninstall"
            ? "Alt+U"
            : action.id === "properties"
              ? "Alt+P"
              : "Alt+L",
      onSelect: () => {
        if (!action.disabled) {
          void executeAppAction(action.id, currentApp);
        }
      },
      disabled: busy || action.disabled,
    }));

  return {
    panel: {
      title: "Apps",
      icon: Rocket,
    },
    registerControls: registerFooterControls,
    primaryAction: {
      id: "open-app",
      label: "Open App",
      icon: Rocket,
      onSelect: () => {
        void executeAppAction("open", currentApp);
      },
      disabled: busy,
      loading: busy && busyActionId === "open",
      shortcutHint: "Enter",
    },
    extraActions,
  };
}
