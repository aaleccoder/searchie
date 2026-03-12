import * as React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LauncherPanel } from "@/components/launcher/launcher-panel";
import { CommandRegistryContext, createCommandRegistry } from "@/lib/command-registry";
import { PanelRegistryContext, createPanelRegistry } from "@/lib/panel-registry";
import type { ShortcutCommandDescriptor, ShortcutPanelDescriptor } from "@/lib/panel-contract";
import { createPrefixAliasMatcher } from "@/lib/panel-matchers";
import { definePanel } from "../framework";
import { buildAppsPanels } from "@/plugins/core/internal/apps";

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    hide: vi.fn(),
  }),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async () => () => undefined),
}));

function createTestRegistry(panel?: ShortcutPanelDescriptor) {
  const registry = createPanelRegistry();
  if (panel) {
    registry.register(definePanel(panel));
  }
  return registry;
}

function createRegistryWithPanels(panels: ShortcutPanelDescriptor[]) {
  const registry = createPanelRegistry();
  for (const panel of panels) {
    registry.register(definePanel(panel));
  }
  return registry;
}

function renderLauncherWithRegistry(registry = createTestRegistry()) {
  const commandRegistry = createCommandRegistry();
  return render(
    <CommandRegistryContext.Provider value={commandRegistry}>
      <PanelRegistryContext.Provider value={registry}>
        <LauncherPanel expanded onExpandedChange={vi.fn()} onOpenSettings={vi.fn()} />
      </PanelRegistryContext.Provider>
    </CommandRegistryContext.Provider>,
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

  it("activates immediate panel mode while typing and uses launcher input as panel query", async () => {
    const customPanel: ShortcutPanelDescriptor = {
      id: "test-panel",
      name: "Test Panel",
      aliases: ["tp"],
      capabilities: [],
      matcher: createPrefixAliasMatcher(["tp"]),
      searchIntegration: {
        activationMode: "immediate",
        placeholder: "Search test panel...",
      },
      component: ({ commandQuery }) => <div>Panel query: {commandQuery}</div>,
      priority: 5,
    };

    const user = userEvent.setup();
    renderLauncherWithRegistry(createTestRegistry(customPanel));

    const input = screen.getByPlaceholderText("Search apps...");
    await user.type(input, "tp hello");

    expect(await screen.findByText("Panel query: hello")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search test panel...")).toBeInTheDocument();
  });

  it("shows command suggestions in default launcher mode", async () => {
    const customPanel: ShortcutPanelDescriptor = {
      id: "test-panel",
      name: "Test Panel",
      aliases: ["tp"],
      capabilities: [],
      matcher: createPrefixAliasMatcher(["tp"]),
      component: () => <div>Test Panel</div>,
      searchIntegration: {
        activationMode: "result-item",
      },
      priority: 5,
    };

    const user = userEvent.setup();
    renderLauncherWithRegistry(createTestRegistry(customPanel));

    const input = screen.getByPlaceholderText("Search apps...");
    await user.type(input, "test");

    expect(screen.getByText("Open Test Panel")).toBeInTheDocument();
  });

  it("executes a direct command from the top-level launcher on Enter", async () => {
    const user = userEvent.setup();
    const execute = vi.fn(async () => undefined);
    const commandRegistry = createCommandRegistry();
    const command: ShortcutCommandDescriptor = {
      id: "brightness-up",
      name: "Brightness Up",
      aliases: ["brightness up", "bright up"],
      capabilities: [],
      matcher: createPrefixAliasMatcher(["brightness up", "bright up"]),
      execute,
    };
    commandRegistry.register(command);

    render(
      <CommandRegistryContext.Provider value={commandRegistry}>
        <PanelRegistryContext.Provider value={createTestRegistry()}>
          <LauncherPanel expanded onExpandedChange={vi.fn()} onOpenSettings={vi.fn()} />
        </PanelRegistryContext.Provider>
      </CommandRegistryContext.Provider>,
    );

    const input = screen.getByPlaceholderText("Search apps...");
    await user.type(input, "brightness up");

    expect(await screen.findByRole("button", { name: /Run Brightness Up/i })).toBeInTheDocument();

    await user.keyboard("{Enter}");

    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        rawQuery: "brightness up",
        commandQuery: "",
      }),
    );
  });

  it("does not show direct commands when the launcher query is empty", () => {
    const commandRegistry = createCommandRegistry();
    commandRegistry.register({
      id: "brightness-up",
      name: "Brightness Up",
      aliases: ["brightness up"],
      capabilities: [],
      matcher: createPrefixAliasMatcher(["brightness up"]),
      execute: async () => undefined,
    });

    render(
      <CommandRegistryContext.Provider value={commandRegistry}>
        <PanelRegistryContext.Provider value={createTestRegistry()}>
          <LauncherPanel expanded onExpandedChange={vi.fn()} onOpenSettings={vi.fn()} />
        </PanelRegistryContext.Provider>
      </CommandRegistryContext.Provider>,
    );

    expect(screen.queryByText("Run Brightness Up")).not.toBeInTheDocument();
  });

  it("shows direct commands for similar launcher queries", async () => {
    const user = userEvent.setup();
    const commandRegistry = createCommandRegistry();
    commandRegistry.register({
      id: "brightness-up",
      name: "Brightness Up",
      aliases: ["brightness up", "bright up"],
      capabilities: [],
      matcher: createPrefixAliasMatcher(["brightness up", "bright up"]),
      execute: async () => undefined,
    });

    render(
      <CommandRegistryContext.Provider value={commandRegistry}>
        <PanelRegistryContext.Provider value={createTestRegistry()}>
          <LauncherPanel expanded onExpandedChange={vi.fn()} onOpenSettings={vi.fn()} />
        </PanelRegistryContext.Provider>
      </CommandRegistryContext.Provider>,
    );

    const input = screen.getByPlaceholderText("Search apps...");
    await user.type(input, "brig");

    expect(await screen.findByRole("button", { name: /Run Brightness Up/i })).toBeInTheDocument();
  });

  it("routes plain text query into default panel without needing alias", async () => {
    const defaultPanel: ShortcutPanelDescriptor = {
      id: "apps-launcher",
      name: "Apps",
      aliases: ["apps"],
      isDefault: true,
      capabilities: [],
      matcher: createPrefixAliasMatcher(["apps"]),
      component: ({ commandQuery }) => <div>Apps query: {commandQuery}</div>,
      priority: 20,
    };

    const user = userEvent.setup();
    renderLauncherWithRegistry(createTestRegistry(defaultPanel));

    const input = screen.getByPlaceholderText("Search apps...");
    await user.type(input, "notepad");

    expect(screen.getByText("Apps query: notepad")).toBeInTheDocument();
  });

  it("shows an empty message when no panel command matches", async () => {
    renderLauncherWithRegistry();
    const user = userEvent.setup();
    const input = screen.getByPlaceholderText("Search apps...");
    await user.type(input, "unknown panel command");

    expect(screen.getByText("No matching panel command.")).toBeInTheDocument();
  });

  it("selects and activates a result-item panel with Enter", async () => {
    const customPanel: ShortcutPanelDescriptor = {
      id: "test-panel",
      name: "Test Panel",
      aliases: ["tp"],
      capabilities: [],
      matcher: createPrefixAliasMatcher(["tp"]),
      searchIntegration: {
        activationMode: "result-item",
      },
      component: () => <div>Test Panel</div>,
      priority: 5,
    };

    const user = userEvent.setup();
    renderLauncherWithRegistry(createTestRegistry(customPanel));

    const input = screen.getByPlaceholderText("Search apps...");
    await user.type(input, "tp");
    await user.keyboard("{Enter}");

    expect(screen.getByText("Test Panel")).toBeInTheDocument();
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

  it("moves command selection with ArrowDown even when focus left launcher input", async () => {
    const user = userEvent.setup();

    const firstPanel: ShortcutPanelDescriptor = {
      id: "test-panel-one",
      name: "Test Panel One",
      aliases: ["tp1"],
      capabilities: [],
      matcher: createPrefixAliasMatcher(["tp1"]),
      component: () => <div>Panel One</div>,
      searchIntegration: {
        activationMode: "result-item",
      },
      priority: 5,
    };

    const secondPanel: ShortcutPanelDescriptor = {
      id: "test-panel-two",
      name: "Test Panel Two",
      aliases: ["tp2"],
      capabilities: [],
      matcher: createPrefixAliasMatcher(["tp2"]),
      component: () => <div>Panel Two</div>,
      searchIntegration: {
        activationMode: "result-item",
      },
      priority: 4,
    };

    renderLauncherWithRegistry(createRegistryWithPanels([firstPanel, secondPanel]));

    const input = screen.getByPlaceholderText("Search apps...");
    await user.type(input, "tp");

    const settingsButton = screen.getByLabelText("Open settings");
    settingsButton.focus();
    expect(settingsButton).toHaveFocus();

    await user.keyboard("{ArrowDown}");

    expect(screen.getByRole("button", { name: /Open Test Panel Two/i })).toHaveClass(
      "border-primary/70",
    );
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

  it("shows a back button in non-default panel mode and returns to default launcher on click", async () => {
    const user = userEvent.setup();

    const customPanel: ShortcutPanelDescriptor = {
      id: "test-panel",
      name: "Test Panel",
      aliases: ["tp"],
      capabilities: [],
      matcher: createPrefixAliasMatcher(["tp"]),
      component: ({ commandQuery }) => <div>Panel query: {commandQuery}</div>,
      searchIntegration: {
        activationMode: "immediate",
      },
      priority: 5,
    };

    renderLauncherWithRegistry(createTestRegistry(customPanel));

    const input = screen.getByPlaceholderText("Search apps...");
    await user.type(input, "tp hello");

    expect(screen.getByText("Panel query: hello")).toBeInTheDocument();
    const backButton = screen.getByLabelText("Go back to default panel");
    await user.click(backButton);

    expect(screen.queryByText("Panel query: hello")).not.toBeInTheDocument();
    expect(screen.getByText("Command Panels")).toBeInTheDocument();
    expect((input as HTMLInputElement).value).toBe("");
    expect(input).toHaveFocus();
  });

  it("does not show the back button in default launcher mode", () => {
    renderLauncherWithRegistry();
    expect(screen.queryByLabelText("Go back to default panel")).not.toBeInTheDocument();
  });

  it("exits panel mode on Escape and returns to launcher search", async () => {
    const user = userEvent.setup();

    const customPanel: ShortcutPanelDescriptor = {
      id: "test-panel",
      name: "Test Panel",
      aliases: ["tp"],
      capabilities: [],
      matcher: createPrefixAliasMatcher(["tp"]),
      component: () => <div>Test Panel Content</div>,
      priority: 5,
    };

    renderLauncherWithRegistry(createTestRegistry(customPanel));

    const input = screen.getByPlaceholderText("Search apps...");
    await user.type(input, "tp");
    expect(screen.getByText("Test Panel Content")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByText("Test Panel Content")).not.toBeInTheDocument();
    expect(screen.getByText("Command Panels")).toBeInTheDocument();
    expect((input as HTMLInputElement).value).toBe("");
    expect(input).toHaveFocus();
  });

  it("injects result-item panel into apps results and activates it with Enter", async () => {
    invokeMock.mockImplementation(async (command: string) => {
      if (command === "list_installed_apps") {
        return [
          {
            id: "app-1",
            name: "Clip Studio",
            launchPath: "C:/ClipStudio.exe",
            launchArgs: [],
            source: "test",
          },
        ];
      }

      if (command === "search_installed_apps") {
        return [
          {
            id: "app-1",
            name: "Clip Studio",
            launchPath: "C:/ClipStudio.exe",
            launchArgs: [],
            source: "test",
          },
        ];
      }

      if (command === "launch_installed_app") return null;
      if (command === "get_app_icon") return null;
      return null;
    });

    const clipboardPanel: ShortcutPanelDescriptor = {
      id: "clipboard",
      name: "Clipboard",
      aliases: ["cl", "clip", "clipboard"],
      capabilities: [],
      matcher: createPrefixAliasMatcher(["cl", "clip", "clipboard"]),
      searchIntegration: {
        activationMode: "result-item",
      },
      appsLauncherIntegration: {
        injectAsApp: true,
      },
      component: () => <div>Clipboard Panel</div>,
      priority: 30,
    };

    const registry = createRegistryWithPanels([...buildAppsPanels(), clipboardPanel]);
    const user = userEvent.setup();
    renderLauncherWithRegistry(registry);

    const input = screen.getByPlaceholderText("Search apps...");
    await user.type(input, "clip");

    const clipboardCommand = await screen.findByRole("button", { name: /Open Clipboard/i });
    await user.click(clipboardCommand);

    expect(screen.getByText("Clipboard Panel")).toBeInTheDocument();
  });

  it("opens hotkeys helper panel and shows active panel shortcuts", async () => {
    const panelWithShortcuts: ShortcutPanelDescriptor = {
      id: "test-panel",
      name: "Test Panel",
      aliases: ["tp"],
      capabilities: [],
      matcher: createPrefixAliasMatcher(["tp"]),
      searchIntegration: {
        activationMode: "immediate",
      },
      shortcuts: [{ keys: "Mod+K", description: "Run panel action" }],
      component: () => <div>Test Panel</div>,
      priority: 5,
    };

    const hotkeysPanel: ShortcutPanelDescriptor = {
      id: "hotkeys",
      name: "Hotkeys",
      aliases: ["?", "help"],
      capabilities: [],
      matcher: createPrefixAliasMatcher(["?", "help"]),
      searchIntegration: {
        activationMode: "result-item",
      },
      component: ({ commandQuery }) => <div>Hotkeys for: {commandQuery || "launcher"}</div>,
      priority: 4,
    };

    const user = userEvent.setup();
    renderLauncherWithRegistry(createRegistryWithPanels([panelWithShortcuts, hotkeysPanel]));

    const input = screen.getByPlaceholderText("Search apps...");
    await user.type(input, "tp");

    await user.click(screen.getByLabelText("Show keyboard shortcuts"));

    expect(screen.getByText("Hotkeys for: test-panel")).toBeInTheDocument();
  });

  it("does not collapse when clearing query inside an active panel session", async () => {
    const resultItemPanel: ShortcutPanelDescriptor = {
      id: "clipboard",
      name: "Clipboard",
      aliases: ["clip", "clipboard"],
      capabilities: [],
      matcher: createPrefixAliasMatcher(["clip", "clipboard"]),
      searchIntegration: {
        activationMode: "result-item",
      },
      component: ({ commandQuery }) => <div>Clipboard query: {commandQuery}</div>,
      priority: 5,
    };

    const onExpandedChange = vi.fn();
    const registry = createTestRegistry(resultItemPanel);
    const user = userEvent.setup();

    render(
      <CommandRegistryContext.Provider value={createCommandRegistry()}>
        <PanelRegistryContext.Provider value={registry}>
          <LauncherPanel expanded onExpandedChange={onExpandedChange} onOpenSettings={vi.fn()} />
        </PanelRegistryContext.Provider>
      </CommandRegistryContext.Provider>,
    );

    const input = screen.getByPlaceholderText("Search apps...");
    await user.type(input, "clip");
    await user.keyboard("{Enter}");

    expect(await screen.findByText("Clipboard query:")).toBeInTheDocument();

    await user.clear(input);

    expect(screen.getByText("Clipboard query:")).toBeInTheDocument();
    expect(onExpandedChange).not.toHaveBeenCalledWith(false);
  });

  it("renders panel-controlled footer actions and runs both primary and dropdown actions", async () => {
    const runPrimary = vi.fn();
    const runExtra = vi.fn();

    const customPanel: ShortcutPanelDescriptor = {
      id: "test-panel",
      name: "Test Panel",
      aliases: ["tp"],
      capabilities: [],
      matcher: createPrefixAliasMatcher(["tp"]),
      searchIntegration: {
        activationMode: "immediate",
      },
      component: ({ registerPanelFooter }) => {
        React.useEffect(() => {
          registerPanelFooter?.({
            helperText: "Footer actions",
            primaryAction: {
              id: "primary",
              label: "Run Primary",
              onSelect: runPrimary,
            },
            extraActions: [
              {
                id: "extra",
                label: "Run Extra",
                onSelect: runExtra,
              },
            ],
          });

          return () => {
            registerPanelFooter?.(null);
          };
        }, [registerPanelFooter, runExtra, runPrimary]);

        return <div>Footer Test Panel</div>;
      },
      priority: 5,
    };

    const user = userEvent.setup();
    renderLauncherWithRegistry(createTestRegistry(customPanel));

    const input = screen.getByPlaceholderText("Search apps...");
    await user.type(input, "tp");

    await user.click(screen.getByRole("button", { name: "Run Primary" }));
    expect(runPrimary).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: /More/i }));
    await user.click(await screen.findByText("Run Extra"));
    expect(runExtra).toHaveBeenCalledTimes(1);
  });
});
