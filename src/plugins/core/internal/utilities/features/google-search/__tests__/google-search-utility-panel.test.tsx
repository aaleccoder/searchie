import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { GoogleSearchUtilityPanel } from "../google-search-utility-panel";

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));

describe("GoogleSearchUtilityPanel", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue(null);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ["best coffee", ["best coffee near me", "best coffee beans"]],
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens selected suggestion on Enter", async () => {
    const registerInputEnterHandler = vi.fn();
    render(
      <GoogleSearchUtilityPanel
        commandQuery="best coffee"
        registerInputEnterHandler={registerInputEnterHandler}
      />,
    );

    expect(registerInputEnterHandler).toHaveBeenCalled();

    await screen.findAllByText("best coffee");

    const latestCall = registerInputEnterHandler.mock.calls[registerInputEnterHandler.mock.calls.length - 1];
    const handler = latestCall?.[0];
    expect(handler).toBeTypeOf("function");

    handler();

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("shell_execute_w", {
        target: "https://www.google.com/search?q=best%20coffee",
      });
    });
  });

  it("renders empty state when query is blank", () => {
    render(<GoogleSearchUtilityPanel commandQuery="" />);
    expect(screen.getByText("Search Google instantly")).toBeInTheDocument();
  });
});
