import { convertFileSrc } from "@tauri-apps/api/core";
import type { PanelCommandScope } from "@/lib/tauri-commands";
import { invokePanelCommand } from "@/lib/tauri-commands";
import {
  listPluginConfigDefinitions,
  readPluginConfig,
  readPluginConfigSnapshot,
  registerPluginConfigDefinitions,
  writePluginConfig,
} from "@/lib/plugin-config-store";
import type { PluginConfigDefinition, PluginConfigValue } from "@/lib/plugin-contract";

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
  openUrl: (target: string) => Promise<void>;
  googleSuggest: (query: string) => Promise<unknown>;
  updateShortcut: (oldShortcut: string, newShortcut: string) => Promise<void>;
};

export type SystemPowerProfile = "balanced" | "power-saver" | "performance";

export type SystemBackendResult = {
  applied: boolean;
  usedFallback?: boolean;
  message?: string;
};

export type SystemSdk = {
  mediaPlayPause: () => Promise<SystemBackendResult>;
  mediaNext: () => Promise<SystemBackendResult>;
  mediaPrevious: () => Promise<SystemBackendResult>;
  setVolume: (value: number) => Promise<SystemBackendResult>;
  changeVolume: (delta: number) => Promise<SystemBackendResult>;
  setMute: (muted: boolean) => Promise<SystemBackendResult>;
  toggleMute: () => Promise<SystemBackendResult>;
  getBrightness: () => Promise<number | null>;
  setBrightness: (value: number) => Promise<SystemBackendResult>;
  changeBrightness: (delta: number) => Promise<SystemBackendResult>;
  setWifiEnabled: (enabled: boolean) => Promise<SystemBackendResult>;
  toggleWifi: () => Promise<SystemBackendResult>;
  setBluetoothEnabled: (enabled: boolean) => Promise<SystemBackendResult>;
  toggleBluetooth: () => Promise<SystemBackendResult>;
  setAirplaneMode: (enabled: boolean) => Promise<SystemBackendResult>;
  toggleAirplaneMode: () => Promise<SystemBackendResult>;
  setHotspotEnabled: (enabled: boolean) => Promise<SystemBackendResult>;
  toggleHotspot: () => Promise<SystemBackendResult>;
  setPowerProfile: (profile: SystemPowerProfile) => Promise<SystemBackendResult>;
  openSettingsUri: (uri: string) => Promise<SystemBackendResult>;
};

export type PluginBackendSdk = {
  apps: AppsSdk;
  clipboard: ClipboardSdk;
  files: FilesSdk;
  window: WindowSdk;
  system: SystemSdk;
  config: {
    defineConfig: (configKey: string, configValueType: PluginConfigDefinition["valueType"], optional?: boolean) => void;
    listConfigDefinitions: () => PluginConfigDefinition[];
    getConfig: <T extends PluginConfigValue = PluginConfigValue>(configKey: string) => Promise<T | undefined>;
    setConfig: (configKey: string, value: PluginConfigValue) => Promise<void>;
    listConfigValues: () => Promise<Record<string, PluginConfigValue>>;
  };
};

const runtimeDefinitions = new Map<string, Map<string, PluginConfigDefinition>>();

function getRequiredPluginId(scope: PanelCommandScope): string {
  const pluginId = scope.pluginId?.trim();
  if (!pluginId) {
    throw new Error(`Panel "${scope.id}" does not include a pluginId scope.`);
  }
  return pluginId;
}

function getRuntimeDefinitionRegistry(pluginId: string): Map<string, PluginConfigDefinition> {
  const existing = runtimeDefinitions.get(pluginId);
  if (existing) {
    return existing;
  }

  const next = new Map<string, PluginConfigDefinition>();
  runtimeDefinitions.set(pluginId, next);
  return next;
}

export function createPluginBackendSdk(scope: PanelCommandScope): PluginBackendSdk {
  const pluginId = getRequiredPluginId(scope);

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
      openUrl: (target: string) => invokePanelCommand<void>(scope, "shell_execute_w", { target }),
      googleSuggest: (query: string) => invokePanelCommand<unknown>(scope, "google_suggest", { query }),
      updateShortcut: (oldShortcut: string, newShortcut: string) =>
        invokePanelCommand<void>(scope, "update_shortcut", { oldShortcut, newShortcut }),
    },
    system: {
      mediaPlayPause: () => invokePanelCommand<SystemBackendResult>(scope, "media_play_pause", {}),
      mediaNext: () => invokePanelCommand<SystemBackendResult>(scope, "media_next", {}),
      mediaPrevious: () => invokePanelCommand<SystemBackendResult>(scope, "media_previous", {}),
      setVolume: (value: number) => invokePanelCommand<SystemBackendResult>(scope, "set_system_volume", { value }),
      changeVolume: (delta: number) =>
        invokePanelCommand<SystemBackendResult>(scope, "change_system_volume", { delta }),
      setMute: (muted: boolean) => invokePanelCommand<SystemBackendResult>(scope, "set_system_mute", { muted }),
      toggleMute: () => invokePanelCommand<SystemBackendResult>(scope, "toggle_system_mute", {}),
      getBrightness: () => invokePanelCommand<number | null>(scope, "get_brightness", {}),
      setBrightness: (value: number) => invokePanelCommand<SystemBackendResult>(scope, "set_brightness", { value }),
      changeBrightness: (delta: number) =>
        invokePanelCommand<SystemBackendResult>(scope, "change_brightness", { delta }),
      setWifiEnabled: (enabled: boolean) =>
        invokePanelCommand<SystemBackendResult>(scope, "set_wifi_enabled", { enabled }),
      toggleWifi: () => invokePanelCommand<SystemBackendResult>(scope, "toggle_wifi", {}),
      setBluetoothEnabled: (enabled: boolean) =>
        invokePanelCommand<SystemBackendResult>(scope, "set_bluetooth_enabled", { enabled }),
      toggleBluetooth: () => invokePanelCommand<SystemBackendResult>(scope, "toggle_bluetooth", {}),
      setAirplaneMode: (enabled: boolean) =>
        invokePanelCommand<SystemBackendResult>(scope, "set_airplane_mode", { enabled }),
      toggleAirplaneMode: () => invokePanelCommand<SystemBackendResult>(scope, "toggle_airplane_mode", {}),
      setHotspotEnabled: (enabled: boolean) =>
        invokePanelCommand<SystemBackendResult>(scope, "set_hotspot_enabled", { enabled }),
      toggleHotspot: () => invokePanelCommand<SystemBackendResult>(scope, "toggle_hotspot", {}),
      setPowerProfile: (profile: SystemPowerProfile) =>
        invokePanelCommand<SystemBackendResult>(scope, "set_power_profile", { profile }),
      openSettingsUri: (uri: string) =>
        invokePanelCommand<SystemBackendResult>(scope, "open_system_settings_uri", { uri }),
    },
    config: {
      defineConfig: (configKey, configValueType, optional = false) => {
        const key = configKey.trim();
        if (!key) {
          throw new Error("Config key cannot be empty.");
        }

        const registry = getRuntimeDefinitionRegistry(pluginId);
        if (registry.has(key)) {
          return;
        }

        registry.set(key, {
          key,
          label: key,
          optional,
          valueType: configValueType,
        });

        const persisted = listPluginConfigDefinitions(pluginId);
        const merged = new Map<string, PluginConfigDefinition>();
        for (const definition of persisted) {
          merged.set(definition.key, definition);
        }
        for (const definition of registry.values()) {
          if (!merged.has(definition.key)) {
            merged.set(definition.key, definition);
          }
        }

        registerPluginConfigDefinitions(pluginId, [...merged.values()]);
      },
      listConfigDefinitions: () => {
        const declared = listPluginConfigDefinitions(pluginId);
        const runtime = [...getRuntimeDefinitionRegistry(pluginId).values()];
        if (runtime.length === 0) {
          return declared;
        }

        const merged = new Map<string, PluginConfigDefinition>();
        for (const definition of declared) {
          merged.set(definition.key, definition);
        }
        for (const definition of runtime) {
          if (!merged.has(definition.key)) {
            merged.set(definition.key, definition);
          }
        }

        return [...merged.values()];
      },
      getConfig: <T extends PluginConfigValue = PluginConfigValue>(configKey: string) =>
        readPluginConfig(pluginId, configKey) as Promise<T | undefined>,
      setConfig: (configKey: string, value: PluginConfigValue) => writePluginConfig(pluginId, configKey, value),
      listConfigValues: () => readPluginConfigSnapshot(pluginId),
    },
  };
}
