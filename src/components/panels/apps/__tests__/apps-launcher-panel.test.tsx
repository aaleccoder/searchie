import type * as React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppsLauncherPanel } from "@/components/panels/apps/apps-launcher-panel";
import { PanelRegistryContext, createPanelRegistry } from "@/lib/panel-registry";

const { invokePanelCommandMock } = vi.hoisted(() => ({
  invokePanelCommandMock: vi.fn(),
}));

vi.mock("@/lib/tauri-commands", () => ({
  invokePanelCommand: invokePanelCommandMock,
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
    invokePanelCommandMock.mockImplementation(async (_scope: unknown, command: string) => {
      if (command === "list_installed_apps") {
        return apps;
      }

      if (command === "search_installed_apps") {
        return apps;
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
    const openAction = screen.getByRole("button", { name: /Open App/i });
    fireEvent.mouseEnter(openAction);
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
});
