import { beforeEach, describe, expect, it, vi } from "vitest";
import { definePanel } from "@/components/framework";
import type { ShortcutPanelDescriptor } from "@/lib/panel-contract";
import { invokePanelCommand, PanelCommandError } from "@/lib/tauri-commands";

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));

const launcherPanel: ShortcutPanelDescriptor = definePanel({
  pluginId: "core.apps",
  id: "launcher",
  name: "Launcher",
  aliases: [],
  capabilities: [
    "apps.list",
    "apps.search",
    "apps.launch",
    "apps.launchAdmin",
    "apps.uninstall",
    "apps.properties",
    "apps.location",
    "apps.icon",
    "settings.read",
  ],
  matcher: () => ({ matches: false, commandQuery: "" }),
  component: () => null,
});

describe("invokePanelCommand", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("invokes allowed commands", async () => {
    invokeMock.mockResolvedValueOnce([{ id: "a" }]);

    const result = await invokePanelCommand<{ id: string }[]>(
      launcherPanel,
      "list_installed_apps",
      {},
    );

    expect(result).toEqual([{ id: "a" }]);
    expect(invokeMock).toHaveBeenCalledWith("list_installed_apps", {});
  });

  it("invokes newly added app action commands when capability allows", async () => {
    invokeMock.mockResolvedValueOnce(null);

    await invokePanelCommand<void>(launcherPanel, "open_installed_app_properties", {
      appId: "a",
    });

    expect(invokeMock).toHaveBeenCalledWith("open_installed_app_properties", { appId: "a" });
  });

  it("invokes shell_execute_w when settings.read capability allows", async () => {
    invokeMock.mockResolvedValueOnce(null);

    await invokePanelCommand<void>(launcherPanel, "shell_execute_w", {
      target: "ms-settings:privacy-webcam",
    });

    expect(invokeMock).toHaveBeenCalledWith("shell_execute_w", {
      target: "ms-settings:privacy-webcam",
    });
  });

  it("invokes set_system_volume when system.volume capability allows", async () => {
    const systemPanel: ShortcutPanelDescriptor = definePanel({
      pluginId: "core.system",
      id: "system-volume",
      name: "System Volume",
      aliases: ["volume"],
      capabilities: ["system.volume"],
      matcher: () => ({ matches: false, commandQuery: "" }),
      component: () => null,
    });

    invokeMock.mockResolvedValueOnce(null);

    await invokePanelCommand<void>(systemPanel, "set_system_volume", {
      value: 42,
    });

    expect(invokeMock).toHaveBeenCalledWith("set_system_volume", { value: 42 });
  });

  it("allows batched icon command under apps.icon capability", async () => {
    invokeMock.mockResolvedValueOnce({ a: null });

    await invokePanelCommand<Record<string, string | null>>(launcherPanel, "get_app_icons", {
      appIds: ["a"],
    });

    expect(invokeMock).toHaveBeenCalledWith("get_app_icons", { appIds: ["a"] });
  });

  it("rejects disallowed commands", async () => {
    await expect(
      invokePanelCommand(launcherPanel, "search_clipboard_history", { query: "x" }),
    ).rejects.toBeInstanceOf(PanelCommandError);

    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("wraps invoke failures", async () => {
    invokeMock.mockRejectedValueOnce(new Error("boom"));

    await expect(
      invokePanelCommand(launcherPanel, "search_installed_apps", { query: "abc" }),
    ).rejects.toMatchObject({
      name: "PanelCommandError",
      code: "COMMAND_FAILED",
      panelId: "launcher",
      pluginId: "core.apps",
      command: "search_installed_apps",
    });
  });
});
