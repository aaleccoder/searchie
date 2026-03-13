import { beforeEach, describe, expect, it, vi } from "vitest";
import { gotoCommand } from "../goto-command";

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));

describe("gotoCommand", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue(null);
  });

  it("matches goto aliases with a target", () => {
    expect(gotoCommand.matcher("goto example.com")).toEqual({
      matches: true,
      commandQuery: "example.com",
    });
    expect(gotoCommand.matcher("go to example.com")).toEqual({
      matches: true,
      commandQuery: "example.com",
    });
  });

  it("does not match when target is missing", () => {
    expect(gotoCommand.matcher("goto")).toEqual({
      matches: false,
      commandQuery: "",
    });
  });

  it("executes and opens url", async () => {
    await gotoCommand.execute({
      rawQuery: "goto example.com",
      commandQuery: "example.com",
      source: "launcher",
    });

    expect(invokeMock).toHaveBeenCalledWith("shell_execute_w", {
      target: "https://example.com",
    });
  });

  it("skips execution when commandQuery is empty", async () => {
    await gotoCommand.execute({
      rawQuery: "goto",
      commandQuery: "",
      source: "launcher",
    });

    expect(invokeMock).not.toHaveBeenCalled();
  });
});
