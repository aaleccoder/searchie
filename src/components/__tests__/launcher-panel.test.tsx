import * as React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { LauncherPanel } from "@/components/launcher-panel";
import { PanelRegistryContext, createPanelRegistry } from "@/lib/panel-registry";
import type { ShortcutPanelDescriptor } from "@/lib/panel-contract";
import { createPrefixAliasMatcher } from "@/lib/panel-matchers";

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async () => () => {}),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    hide: vi.fn(),
  }),
}));

function createTestRegistry(panel?: ShortcutPanelDescriptor) {
  const registry = createPanelRegistry();
  if (panel) {
    registry.register(panel);
  }
  return registry;
}

function renderLauncherWithRegistry(registry = createTestRegistry()) {
  return render(
    <PanelRegistryContext.Provider value={registry}>
      <LauncherPanel expanded onExpandedChange={vi.fn()} onOpenSettings={vi.fn()} />
    </PanelRegistryContext.Provider>,
  );
}

describe("LauncherPanel with panel registry", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockImplementation(async (command: string) => {
      if (command === "list_installed_apps") return [];
      if (command === "search_installed_apps") return [];
      if (command === "launch_installed_app") return null;
      if (command === "get_app_icon") return null;
      return null;
    });
  });

  it("renders injected panel when command alias matches", async () => {
    const customPanel: ShortcutPanelDescriptor = {
      id: "test-panel",
      name: "Test Panel",
      aliases: ["tp"],
      capabilities: [],
      matcher: createPrefixAliasMatcher(["tp"]),
      component: ({ commandQuery }) => <div>Panel query: {commandQuery}</div>,
      priority: 5,
    };

    const user = userEvent.setup();
    renderLauncherWithRegistry(createTestRegistry(customPanel));

    const input = screen.getByPlaceholderText("Search apps...");
    await user.type(input, "tp hello");
    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("list_installed_apps", {});
    });

    expect(await screen.findByText("Panel query: hello")).toBeInTheDocument();
  });

  it("falls back to default launcher when no panel matches", async () => {
    renderLauncherWithRegistry();
    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("list_installed_apps", {});
    });

    expect(screen.getByText("No apps found.")).toBeInTheDocument();
  });

  it("does not launch selected app while a panel is active", async () => {
    const customPanel: ShortcutPanelDescriptor = {
      id: "test-panel",
      name: "Test Panel",
      aliases: ["tp"],
      capabilities: [],
      matcher: createPrefixAliasMatcher(["tp"]),
      component: () => <div>Test Panel</div>,
      priority: 5,
    };

    const user = userEvent.setup();
    renderLauncherWithRegistry(createTestRegistry(customPanel));

    const input = screen.getByPlaceholderText("Search apps...");
    await user.type(input, "tp");
    await user.keyboard("{Enter}");
    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("list_installed_apps", {});
    });

    const launched = invokeMock.mock.calls.some((call) => call[0] === "launch_installed_app");
    expect(launched).toBe(false);
  });

  it("lets the active panel consume keyboard events", async () => {
    const consumeEscape = vi.fn(() => true);
    const customPanel: ShortcutPanelDescriptor = {
      id: "test-panel",
      name: "Test Panel",
      aliases: ["tp"],
      capabilities: [],
      matcher: createPrefixAliasMatcher(["tp"]),
      component: () => <div>Keyboard Panel</div>,
      onInputKeyDown: (event) => {
        if (event.key === "Escape") {
          return consumeEscape();
        }
        return false;
      },
      priority: 5,
    };

    const user = userEvent.setup();
    renderLauncherWithRegistry(createTestRegistry(customPanel));

    const input = screen.getByPlaceholderText("Search apps...");
    await user.type(input, "tp hello");
    await user.keyboard("{Escape}");

    expect(consumeEscape).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Keyboard Panel")).toBeInTheDocument();
    expect((input as HTMLInputElement).value).toBe("tp hello");
  });

  it("hands ArrowDown focus to the active panel target", async () => {
    const user = userEvent.setup();

    const customPanel: ShortcutPanelDescriptor = {
      id: "test-panel",
      name: "Test Panel",
      aliases: ["tp"],
      capabilities: [],
      matcher: createPrefixAliasMatcher(["tp"]),
      component: ({ registerInputArrowDownHandler }) => {
        const targetRef = React.useRef<HTMLButtonElement>(null);

        React.useEffect(() => {
          registerInputArrowDownHandler?.(() => {
            targetRef.current?.focus();
            return true;
          });

          return () => {
            registerInputArrowDownHandler?.(null);
          };
        }, [registerInputArrowDownHandler]);

        return <button ref={targetRef}>Panel Focus Target</button>;
      },
      priority: 5,
    };

    renderLauncherWithRegistry(createTestRegistry(customPanel));

    const input = screen.getByPlaceholderText("Search apps...");
    await user.type(input, "tp");
    await user.keyboard("{ArrowDown}");

    expect(screen.getByText("Panel Focus Target")).toHaveFocus();
  });

  it("lets a panel return focus to the launcher input", async () => {
    const user = userEvent.setup();

    const customPanel: ShortcutPanelDescriptor = {
      id: "test-panel",
      name: "Test Panel",
      aliases: ["tp"],
      capabilities: [],
      matcher: createPrefixAliasMatcher(["tp"]),
      component: ({ registerInputArrowDownHandler, focusLauncherInput }) => {
        const targetRef = React.useRef<HTMLButtonElement>(null);

        React.useEffect(() => {
          registerInputArrowDownHandler?.(() => {
            targetRef.current?.focus();
            return true;
          });

          return () => {
            registerInputArrowDownHandler?.(null);
          };
        }, [registerInputArrowDownHandler]);

        return (
          <button
            ref={targetRef}
            onKeyDown={(event) => {
              if (event.key === "ArrowUp") {
                event.preventDefault();
                focusLauncherInput?.();
              }
            }}
          >
            Panel Focus Target
          </button>
        );
      },
      priority: 5,
    };

    renderLauncherWithRegistry(createTestRegistry(customPanel));

    const input = screen.getByPlaceholderText("Search apps...");
    await user.type(input, "tp");
    await user.keyboard("{ArrowDown}");
    expect(screen.getByText("Panel Focus Target")).toHaveFocus();

    await user.keyboard("{ArrowUp}");
    expect(input).toHaveFocus();
  });
});
