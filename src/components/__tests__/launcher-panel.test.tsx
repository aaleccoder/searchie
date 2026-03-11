import * as React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LauncherPanel } from "@/components/launcher-panel";
import { PanelRegistryContext, createPanelRegistry } from "@/lib/panel-registry";
import type { ShortcutPanelDescriptor } from "@/lib/panel-contract";
import { createPrefixAliasMatcher } from "@/lib/panel-matchers";

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
});
