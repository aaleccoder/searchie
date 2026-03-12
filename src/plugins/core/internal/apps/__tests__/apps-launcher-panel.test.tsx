import type * as React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { definePanel } from "@/components/framework";
import type { ShortcutPanelDescriptor } from "@/lib/panel-contract";
import { createPrefixAliasMatcher } from "@/lib/panel-matchers";
import { PanelRegistryContext, createPanelRegistry } from "@/lib/panel-registry";
import { AppsLauncherPanel } from "../panels/apps-launcher-panel";

const { invokePanelCommandMock } = vi.hoisted(() => ({
  invokePanelCommandMock: vi.fn(),
}));

const { listenMock } = vi.hoisted(() => ({
  listenMock: vi.fn(),
}));

const { loadCachedAppsListMock, cacheAppsListMock } = vi.hoisted(() => ({
  loadCachedAppsListMock: vi.fn(),
  cacheAppsListMock: vi.fn(),
}));

vi.mock("@/lib/tauri-commands", () => ({
  invokePanelCommand: invokePanelCommandMock,
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: listenMock,
}));

vi.mock("@/lib/apps-list-cache", () => ({
  loadCachedAppsList: loadCachedAppsListMock,
  cacheAppsList: cacheAppsListMock,
}));

type InstalledApp = {
  id: string;
  name: string;
  launchPath: string;
  launchArgs: string[];
  source: string;
  publisher?: string | null;
  version?: string | null;
  installLocation?: string | null;
  uninstallCommand?: string | null;
};

const apps: InstalledApp[] = [
  {
    id: "app-1",
    name: "Notepad",
    launchPath: "C:/Windows/notepad.exe",
    launchArgs: [],
    source: "desktop",
    publisher: "Microsoft",
    version: "1.0",
    installLocation: "C:/Windows",
  },
  {
    id: "app-2",
    name: "Calculator",
    launchPath: "C:/Windows/System32/calc.exe",
    launchArgs: [],
    source: "desktop",
    publisher: "Microsoft",
    version: "2.0",
    installLocation: "C:/Windows/System32",
  },
];

function renderPanel(props?: Partial<React.ComponentProps<typeof AppsLauncherPanel>>) {
  const registry = createPanelRegistry();

  return render(
    <PanelRegistryContext.Provider value={registry}>
      <AppsLauncherPanel commandQuery="" {...props} />
    </PanelRegistryContext.Provider>,
  );
}

describe("AppsLauncherPanel focus and keyboard UX", () => {
  beforeEach(() => {
    invokePanelCommandMock.mockReset();
    listenMock.mockReset();
    loadCachedAppsListMock.mockReset();
    cacheAppsListMock.mockReset();
    loadCachedAppsListMock.mockResolvedValue([]);
    cacheAppsListMock.mockResolvedValue(undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => [
          { settingsPage: "Camera", uri: "ms-settings:privacy-webcam" },
          { settingsPage: "Microphone", uri: "ms-settings:privacy-microphone" },
        ],
      })) as unknown as typeof fetch,
    );
    listenMock.mockResolvedValue(() => undefined);
    invokePanelCommandMock.mockImplementation(async (_scope: unknown, command: string, params: unknown) => {
      if (command === "list_installed_apps") {
        return apps;
      }

      if (command === "search_installed_apps") {
        return apps;
      }

      if (command === "get_app_icons") {
        const input = params as { appIds?: string[] };
        return Object.fromEntries((input.appIds ?? []).map((appId) => [appId, null]));
      }

      if (command === "get_app_icon") {
        return null;
      }

      if (
        command === "launch_installed_app" ||
        command === "launch_installed_app_as_admin" ||
        command === "uninstall_installed_app" ||
        command === "open_installed_app_properties" ||
        command === "open_installed_app_install_location"
      ) {
        return null;
      }

      return null;
    });
  });

  it("moves focus to next list item on ArrowDown with clean focus styles", async () => {
    const user = userEvent.setup();

    renderPanel();

    await screen.findByRole("button", { name: /Notepad/i });
    const secondItem = await screen.findByRole("button", { name: /Calculator/i });
    await user.keyboard("{ArrowDown}");

    expect(secondItem).toHaveFocus();
    expect(secondItem.className).toContain("focus-visible:outline-none");
  });

  it("returns focus to launcher input callback on ArrowUp from first list position", async () => {
    const user = userEvent.setup();
    const focusLauncherInput = vi.fn();

    renderPanel({
      focusLauncherInput,
    });

    await screen.findByRole("button", { name: /Notepad/i });
    await user.keyboard("{ArrowUp}");

    expect(focusLauncherInput).toHaveBeenCalledTimes(1);
  });

  it("keeps list keyboard navigation working after focus is lost to body", async () => {
    const user = userEvent.setup();

    renderPanel();

    await screen.findByRole("button", { name: /Notepad/i });
    document.body.focus();

    await user.keyboard("{ArrowDown}{Enter}");

    await waitFor(() => {
      expect(invokePanelCommandMock).toHaveBeenCalledWith(
        expect.anything(),
        "launch_installed_app",
        { appId: "app-2" },
      );
    });
  });

  it("keeps actions keyboard navigation working after focus is lost", async () => {
    const user = userEvent.setup();

    renderPanel();

    await screen.findByRole("button", { name: /Notepad/i });
    await user.keyboard("{ArrowRight}");
    document.body.focus();

    await user.keyboard("{ArrowDown}{Enter}");

    await waitFor(() => {
      expect(invokePanelCommandMock).toHaveBeenCalledWith(
        expect.anything(),
        "launch_installed_app_as_admin",
        { appId: "app-1" },
      );
    });
  });

  it("focuses launcher input on Escape when focus is outside editable fields", async () => {
    const user = userEvent.setup();
    const focusLauncherInput = vi.fn();

    renderPanel({
      focusLauncherInput,
    });

    await screen.findByRole("button", { name: /Notepad/i });
    document.body.focus();

    await user.keyboard("{Escape}");

    expect(focusLauncherInput).toHaveBeenCalledTimes(1);
  });

  it("clears input and closes launcher immediately when clicking an app", async () => {
    const user = userEvent.setup();
    const clearLauncherInput = vi.fn();
    const closeLauncherWindow = vi.fn();

    renderPanel({
      clearLauncherInput,
      closeLauncherWindow,
    });

    const appButton = await screen.findByRole("button", { name: /Notepad/i });
    await user.click(appButton);

    expect(clearLauncherInput).toHaveBeenCalledTimes(1);
    expect(closeLauncherWindow).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(invokePanelCommandMock).toHaveBeenCalledWith(
        expect.anything(),
        "launch_installed_app",
        { appId: "app-1" },
      );
    });
  });

  it("clears input when opening a panel command item", async () => {
    const user = userEvent.setup();
    const clearLauncherInput = vi.fn();
    const activatePanelSession = vi.fn();
    const registry = createPanelRegistry();
    const clipboardPanel: ShortcutPanelDescriptor = definePanel({
      id: "clipboard",
      name: "Clipboard",
      aliases: ["cl", "clip", "clipboard"],
      capabilities: [],
      matcher: createPrefixAliasMatcher(["cl", "clip", "clipboard"]),
      searchIntegration: { activationMode: "result-item" as const },
      appsLauncherIntegration: { injectAsApp: true },
      component: () => null,
    });
    registry.register(clipboardPanel);

    render(
      <PanelRegistryContext.Provider value={registry}>
        <AppsLauncherPanel
          commandQuery="cl"
          clearLauncherInput={clearLauncherInput}
          activatePanelSession={activatePanelSession}
        />
      </PanelRegistryContext.Provider>,
    );

    const panelCommand = await screen.findByRole("button", { name: /Open Clipboard/i });
    await user.click(panelCommand);

    expect(clearLauncherInput).toHaveBeenCalledTimes(1);
    expect(activatePanelSession).toHaveBeenCalledTimes(1);
  });

  it("shows a back-to-apps button when a panel command item is selected", async () => {
    const user = userEvent.setup();
    const registry = createPanelRegistry();
    const clipboardPanel: ShortcutPanelDescriptor = definePanel({
      id: "clipboard",
      name: "Clipboard",
      aliases: ["cl", "clip", "clipboard"],
      capabilities: [],
      matcher: createPrefixAliasMatcher(["cl", "clip", "clipboard"]),
      searchIntegration: { activationMode: "result-item" as const },
      appsLauncherIntegration: { injectAsApp: true },
      component: () => null,
    });
    registry.register(clipboardPanel);

    render(
      <PanelRegistryContext.Provider value={registry}>
        <AppsLauncherPanel commandQuery="clip" />
      </PanelRegistryContext.Provider>,
    );

    const panelCommand = await screen.findByRole("button", { name: /Open Clipboard/i });
    await user.click(panelCommand);

    expect(screen.getByRole("button", { name: /Back to Apps/i })).toBeInTheDocument();
    expect(screen.getByText("Press Enter to open Clipboard.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Back to Apps/i }));

    expect(screen.getByText("Selected App")).toBeInTheDocument();
  });

  it("renders injected plugin command icon results without waiting for app search", async () => {
    const registry = createPanelRegistry();
    const clipboardPanel: ShortcutPanelDescriptor = definePanel({
      id: "clipboard",
      name: "Clipboard",
      aliases: ["cl", "clip", "clipboard"],
      capabilities: [],
      matcher: createPrefixAliasMatcher(["cl", "clip", "clipboard"]),
      searchIntegration: { activationMode: "result-item" as const },
      appsLauncherIntegration: { injectAsApp: true },
      component: () => null,
    });
    registry.register(clipboardPanel);

    render(
      <PanelRegistryContext.Provider value={registry}>
        <AppsLauncherPanel commandQuery="clip" />
      </PanelRegistryContext.Provider>,
    );

    expect(await screen.findByRole("button", { name: /Open Clipboard/i })).toBeInTheDocument();
  });

  it("registers footer with panel title metadata", async () => {
    const registerPanelFooter = vi.fn();

    renderPanel({
      registerPanelFooter,
    });

    await screen.findByRole("button", { name: /Notepad/i });
    await waitFor(() => {
      const footer = registerPanelFooter.mock.calls[registerPanelFooter.mock.calls.length - 1]?.[0];
      expect(footer?.panel?.title).toBe("Apps");
    });
  });

  it("loads app icons through the batched command", async () => {
    renderPanel();

    await screen.findByRole("button", { name: /Notepad/i });

    await waitFor(() => {
      expect(invokePanelCommandMock).toHaveBeenCalledWith(
        expect.anything(),
        "get_app_icons",
        expect.objectContaining({ appIds: expect.arrayContaining(["app-1", "app-2"]) }),
      );
    });
  });

  it("does not request icons with per-item command", async () => {
    renderPanel();

    await screen.findByRole("button", { name: /Notepad/i });

    await waitFor(() => {
      expect(
        invokePanelCommandMock.mock.calls.some(([, command]) => command === "get_app_icons"),
      ).toBe(true);
    });

    expect(
      invokePanelCommandMock.mock.calls.some(([, command]) => command === "get_app_icon"),
    ).toBe(false);
  });

  it("injects matching Windows settings entries into default app results", async () => {
    renderPanel({ commandQuery: "camera" });

    expect(await screen.findByRole("button", { name: /Open Setting Camera/i })).toBeInTheDocument();
  });

  it("supports msettings-prefixed query in the default apps panel", async () => {
    renderPanel({ commandQuery: "msettings microphone" });

    expect(await screen.findByRole("button", { name: /Open Setting Microphone/i })).toBeInTheDocument();
  });

  it("opens Windows settings URI when selecting a settings entry", async () => {
    const user = userEvent.setup();

    renderPanel({ commandQuery: "camera" });

    const settingsButton = await screen.findByRole("button", { name: /Open Setting Camera/i });
    await user.click(settingsButton);

    expect(invokePanelCommandMock).toHaveBeenCalledWith(
      expect.anything(),
      "shell_execute_w",
      { target: "ms-settings:privacy-webcam" },
    );
  });

  it("loads installed apps once while typing and searches on query updates", async () => {
    const registry = createPanelRegistry();
    const view = render(
      <PanelRegistryContext.Provider value={registry}>
        <AppsLauncherPanel commandQuery="" />
      </PanelRegistryContext.Provider>,
    );

    await screen.findByRole("button", { name: /Notepad/i });

    view.rerender(
      <PanelRegistryContext.Provider value={registry}>
        <AppsLauncherPanel commandQuery="n" />
      </PanelRegistryContext.Provider>,
    );

    view.rerender(
      <PanelRegistryContext.Provider value={registry}>
        <AppsLauncherPanel commandQuery="no" />
      </PanelRegistryContext.Provider>,
    );

    await waitFor(() => {
      const listCalls = invokePanelCommandMock.mock.calls.filter(
        ([, command]) => command === "list_installed_apps",
      );
      expect(listCalls).toHaveLength(1);
    });

    await waitFor(() => {
      const searchCalls = invokePanelCommandMock.mock.calls.filter(
        ([, command]) => command === "search_installed_apps",
      );
      expect(searchCalls.length).toBeGreaterThan(0);
    });
  });

  it("refreshes installed apps when apps-updated event fires", async () => {
    let appsUpdatedHandler: (() => void | Promise<void>) | null = null;
    listenMock.mockImplementation(async (eventName: string, handler: () => void | Promise<void>) => {
      if (eventName === "searchie://apps-updated") {
        appsUpdatedHandler = handler;
      }
      return () => undefined;
    });

    renderPanel();
    await screen.findByRole("button", { name: /Notepad/i });

    const listBefore = invokePanelCommandMock.mock.calls.filter(
      ([, command]) => command === "list_installed_apps",
    ).length;

    expect(appsUpdatedHandler).not.toBeNull();

    await act(async () => {
      await appsUpdatedHandler?.();
    });

    await waitFor(() => {
      const listAfter = invokePanelCommandMock.mock.calls.filter(
        ([, command]) => command === "list_installed_apps",
      ).length;
      expect(listAfter).toBe(listBefore + 1);
    });
  });

  it("renders cached apps immediately before backend refresh resolves", async () => {
    let resolveList: ((value: InstalledApp[]) => void) | null = null;
    loadCachedAppsListMock.mockResolvedValueOnce([{ ...apps[0], name: "Cached Notepad" }]);
    invokePanelCommandMock.mockImplementationOnce(
      () => new Promise<InstalledApp[]>((resolve) => {
        resolveList = resolve;
      }),
    );

    renderPanel();

    expect(await screen.findByRole("button", { name: /Cached Notepad/i })).toBeInTheDocument();

    await act(async () => {
      resolveList?.([{ ...apps[0], name: "Fresh Notepad" }, apps[1]]);
    });

    expect(await screen.findByRole("button", { name: /Fresh Notepad/i })).toBeInTheDocument();
  });

  it("persists refreshed installed apps snapshot", async () => {
    renderPanel();
    await screen.findByRole("button", { name: /Notepad/i });

    await waitFor(() => {
      expect(cacheAppsListMock).toHaveBeenCalledWith(apps);
    });
  });
});
