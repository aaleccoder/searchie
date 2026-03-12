import { invoke } from "@tauri-apps/api/core";
import type { PanelCapability, ShortcutPanelDescriptor } from "@/lib/panel-contract";

export type PanelCommandScope = Pick<ShortcutPanelDescriptor, "id" | "capabilities"> & {
  pluginId?: string;
};

export type BackendCommand =
  | "list_installed_apps"
  | "search_installed_apps"
  | "launch_installed_app"
  | "launch_installed_app_new_instance"
  | "launch_installed_app_as_admin"
  | "uninstall_installed_app"
  | "open_installed_app_properties"
  | "open_installed_app_install_location"
  | "get_app_icons"
  | "get_app_icon"
  | "search_clipboard_history"
  | "clear_clipboard_history"
  | "toggle_clipboard_pin"
  | "delete_clipboard_entry"
  | "search_files"
  | "open_file_path"
  | "set_main_window_mode"
  | "show_settings"
  | "shell_execute_w"
  | "update_shortcut";

const COMMAND_CAPABILITIES: Record<BackendCommand, PanelCapability> = {
  list_installed_apps: "apps.list",
  search_installed_apps: "apps.search",
  launch_installed_app: "apps.launch",
  launch_installed_app_new_instance: "apps.launch",
  launch_installed_app_as_admin: "apps.launchAdmin",
  uninstall_installed_app: "apps.uninstall",
  open_installed_app_properties: "apps.properties",
  open_installed_app_install_location: "apps.location",
  get_app_icons: "apps.icon",
  get_app_icon: "apps.icon",
  search_clipboard_history: "clipboard.search",
  clear_clipboard_history: "clipboard.clear",
  toggle_clipboard_pin: "clipboard.pin",
  delete_clipboard_entry: "clipboard.delete",
  search_files: "files.search",
  open_file_path: "files.open",
  set_main_window_mode: "window.mode",
  show_settings: "settings.read",
  shell_execute_w: "settings.read",
  update_shortcut: "settings.write",
};

export class PanelCommandError extends Error {
  readonly code: "CAPABILITY_DENIED" | "COMMAND_FAILED";
  readonly panelId: string;
  readonly pluginId?: string;
  readonly command: BackendCommand;

  constructor(
    code: "CAPABILITY_DENIED" | "COMMAND_FAILED",
    panelId: string,
    pluginId: string | undefined,
    command: BackendCommand,
    message: string,
  ) {
    super(message);
    this.name = "PanelCommandError";
    this.code = code;
    this.panelId = panelId;
    this.pluginId = pluginId;
    this.command = command;
  }
}

function assertCapability(panel: PanelCommandScope, command: BackendCommand): void {
  const requiredCapability = COMMAND_CAPABILITIES[command];
  const allowed = panel.capabilities.includes(requiredCapability);
  if (!allowed) {
    throw new PanelCommandError(
      "CAPABILITY_DENIED",
      panel.id,
      panel.pluginId,
      command,
      `Panel \"${panel.id}\" is not allowed to invoke \"${command}\".`,
    );
  }
}

export async function invokePanelCommand<T>(
  panel: PanelCommandScope,
  command: BackendCommand,
  params: Record<string, unknown>,
): Promise<T> {
  assertCapability(panel, command);

  try {
    return await invoke<T>(command, params);
  } catch (error) {
    throw new PanelCommandError(
      "COMMAND_FAILED",
      panel.id,
      panel.pluginId,
      command,
      `Command \"${command}\" failed for panel \"${panel.id}\": ${String(error)}`,
    );
  }
}
