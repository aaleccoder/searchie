import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BrightnessControlPanel } from "@/plugins/core/internal/system/panels/brightness-control-panel";

const { invokePanelCommandMock } = vi.hoisted(() => ({
  invokePanelCommandMock: vi.fn(),
}));

vi.mock("@/lib/tauri-commands", () => ({
  invokePanelCommand: invokePanelCommandMock,
}));

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

describe("BrightnessControlPanel", () => {
  beforeEach(() => {
    invokePanelCommandMock.mockReset();
  });

  it("shows current brightness immediately while a slider commit is pending", async () => {
    const setBrightnessDeferred = createDeferred<null>();

    invokePanelCommandMock.mockImplementation(async (_scope: unknown, command: string) => {
      if (command === "get_brightness") {
        return 40;
      }

      if (command === "set_brightness") {
        return setBrightnessDeferred.promise;
      }

      return null;
    });

    render(<BrightnessControlPanel commandQuery="" />);

    await screen.findByText("Current: 40%");

    const slider = screen.getByRole("slider");

    act(() => {
      fireEvent.change(slider, { target: { value: "100" } });
      fireEvent.keyUp(slider, { key: "End", code: "End" });
    });

    await screen.findByText("Current: 100%");

    expect(invokePanelCommandMock).toHaveBeenCalledWith(
      expect.anything(),
      "set_brightness",
      { value: 100 },
    );

    act(() => {
      setBrightnessDeferred.resolve(null);
    });

    await screen.findByText("Brightness set to 100%.");
  });

  it("optimistically updates command-driven brightness changes", async () => {
    const setBrightnessDeferred = createDeferred<null>();

    invokePanelCommandMock.mockImplementation(async (_scope: unknown, command: string) => {
      if (command === "get_brightness") {
        return 40;
      }

      if (command === "set_brightness") {
        return setBrightnessDeferred.promise;
      }

      return null;
    });

    const view = render(<BrightnessControlPanel commandQuery="" />);

    await screen.findByText("Current: 40%");

    view.rerender(<BrightnessControlPanel commandQuery="brightness 75" />);

    await screen.findByText("Current: 75%");

    expect(invokePanelCommandMock).toHaveBeenCalledWith(
      expect.anything(),
      "set_brightness",
      { value: 75 },
    );

    act(() => {
      setBrightnessDeferred.resolve(null);
    });

    await screen.findByText("Brightness set to 75%.");
  });

  it("optimistically updates footer actions and rolls back on failure", async () => {
    const changeBrightnessDeferred = createDeferred<null>();
    const registerPanelFooter = vi.fn();
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    invokePanelCommandMock.mockImplementation(async (_scope: unknown, command: string) => {
      if (command === "get_brightness") {
        return 40;
      }

      if (command === "change_brightness") {
        return changeBrightnessDeferred.promise;
      }

      return null;
    });

    render(<BrightnessControlPanel commandQuery="" registerPanelFooter={registerPanelFooter} />);

    await screen.findByText("Current: 40%");

    const footer = registerPanelFooter.mock.calls[registerPanelFooter.mock.calls.length - 1]?.[0];
    expect(footer?.extraActions).toHaveLength(2);

    act(() => {
      footer.extraActions[1]?.onSelect();
    });

    await screen.findByText("Current: 50%");

    act(() => {
      changeBrightnessDeferred.reject(new Error("failed"));
    });

    await waitFor(() => {
      expect(screen.getByText("Current: 40%")).toBeInTheDocument();
    });

    await screen.findByText("Brightness command failed.");
    consoleErrorSpy.mockRestore();
  });
});
