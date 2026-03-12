import { convertFileSrc } from "@tauri-apps/api/core";
import type { PanelCommandScope } from "@/lib/tauri-commands";
import { invokePanelCommand } from "@/lib/tauri-commands";

export type AppsSdk = {
  listInstalledApps: <T>() => Promise<T>;
  searchInstalledApps: <T>(query: string, limit?: number) => Promise<T>;
  launchInstalledApp: (appId: string) => Promise<void>;
  launchInstalledAppAsAdmin: (appId: string) => Promise<void>;
  uninstallInstalledApp: (appId: string) => Promise<void>;
  openInstalledAppProperties: (appId: string) => Promise<void>;
  openInstalledAppInstallLocation: (appId: string) => Promise<void>;
  getAppIcons: (appIds: string[]) => Promise<Record<string, string | null>>;
  getAppIcon: (appId: string) => Promise<string | null>;
};

export type ClipboardSdk = {
  searchHistory: <T>(query: string, kind: string, limit?: number) => Promise<T>;
  clearHistory: () => Promise<void>;
  togglePin: (id: string) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
};

export type FilesSdk = {
  search: <T>(params: Record<string, unknown>) => Promise<T>;
  openPath: (path: string, reveal?: boolean) => Promise<void>;
  toAssetUrl: (path: string) => string;
};

export type WindowSdk = {
  setMainWindowMode: (mode: "compact" | "launcher" | "settings") => Promise<void>;
  showSettings: () => Promise<void>;
  shellExecuteW: (target: string) => Promise<void>;
  updateShortcut: (oldShortcut: string, newShortcut: string) => Promise<void>;
};

export type PluginBackendSdk = {
  apps: AppsSdk;
  clipboard: ClipboardSdk;
  files: FilesSdk;
  window: WindowSdk;
};

export function createPluginBackendSdk(scope: PanelCommandScope): PluginBackendSdk {
  return {
    apps: {
      listInstalledApps: <T>() => invokePanelCommand<T>(scope, "list_installed_apps", {}),
      searchInstalledApps: <T>(query: string, limit = 160) =>
        invokePanelCommand<T>(scope, "search_installed_apps", { query, limit }),
      launchInstalledApp: (appId: string) =>
        invokePanelCommand<void>(scope, "launch_installed_app", { appId }),
      launchInstalledAppAsAdmin: (appId: string) =>
        invokePanelCommand<void>(scope, "launch_installed_app_as_admin", { appId }),
      uninstallInstalledApp: (appId: string) =>
        invokePanelCommand<void>(scope, "uninstall_installed_app", { appId }),
      openInstalledAppProperties: (appId: string) =>
        invokePanelCommand<void>(scope, "open_installed_app_properties", { appId }),
      openInstalledAppInstallLocation: (appId: string) =>
        invokePanelCommand<void>(scope, "open_installed_app_install_location", { appId }),
      getAppIcons: (appIds: string[]) =>
        invokePanelCommand<Record<string, string | null>>(scope, "get_app_icons", { appIds }),
      getAppIcon: (appId: string) => invokePanelCommand<string | null>(scope, "get_app_icon", { appId }),
    },
    clipboard: {
      searchHistory: <T>(query: string, kind: string, limit = 120) =>
        invokePanelCommand<T>(scope, "search_clipboard_history", { query, kind, limit }),
      clearHistory: () => invokePanelCommand<void>(scope, "clear_clipboard_history", {}),
      togglePin: (id: string) => invokePanelCommand<void>(scope, "toggle_clipboard_pin", { id }),
      deleteEntry: (id: string) => invokePanelCommand<void>(scope, "delete_clipboard_entry", { id }),
    },
    files: {
      search: <T>(params: Record<string, unknown>) => invokePanelCommand<T>(scope, "search_files", params),
      openPath: (path: string, reveal = false) =>
        invokePanelCommand<void>(scope, "open_file_path", { path, reveal }),
      toAssetUrl: (path: string) => convertFileSrc(path),
    },
    window: {
      setMainWindowMode: (mode: "compact" | "launcher" | "settings") =>
        invokePanelCommand<void>(scope, "set_main_window_mode", { mode }),
      showSettings: () => invokePanelCommand<void>(scope, "show_settings", {}),
      shellExecuteW: (target: string) => invokePanelCommand<void>(scope, "shell_execute_w", { target }),
      updateShortcut: (oldShortcut: string, newShortcut: string) =>
        invokePanelCommand<void>(scope, "update_shortcut", { oldShortcut, newShortcut }),
    },
  };
}
