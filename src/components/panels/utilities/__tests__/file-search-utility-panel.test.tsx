import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FileSearchUtilityPanel } from "@/plugins/core/internal/file-search-utility-panel";

const { invokePanelCommandMock } = vi.hoisted(() => ({
  invokePanelCommandMock: vi.fn(),
}));

vi.mock("@/lib/tauri-commands", () => ({
  invokePanelCommand: invokePanelCommandMock,
}));

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (path: string) => `asset://${path}`,
}));

const fileResults = [
  {
    path: "C:/Users/ardev/Documents/report.txt",
    name: "report.txt",
    extension: "txt",
    indexedAt: 1731000000000,
  },
];

function getListContainerFromResultText(resultText: string): HTMLDivElement {
  const itemButton = screen.getByRole("button", { name: new RegExp(resultText, "i") });
  const listContainer = itemButton.parentElement;
  if (!listContainer) {
    throw new Error("Could not resolve file search list container");
  }
  return listContainer as HTMLDivElement;
}

describe("FileSearchUtilityPanel", () => {
  beforeEach(() => {
    invokePanelCommandMock.mockReset();
    invokePanelCommandMock.mockImplementation(async (_scope: unknown, command: string) => {
      if (command === "search_files") {
        return fileResults;
      }
      if (command === "open_file_path") {
        return null;
      }
      return null;
    });
  });

  it("registers ArrowDown bridge and focuses the result list", async () => {
    let arrowDownHandler: (() => boolean | void) | null = null;

    render(
      <FileSearchUtilityPanel
        commandQuery="report"
        registerInputArrowDownHandler={(handler) => {
          arrowDownHandler = handler;
        }}
      />,
    );

    await screen.findByText("report.txt");
    const listContainer = getListContainerFromResultText("report.txt");

    if (!arrowDownHandler) {
      throw new Error("Expected ArrowDown handler to be registered");
    }
    document.body.focus();
    const consumed = (arrowDownHandler as () => boolean | void)();

    expect(consumed).toBe(true);
    expect(listContainer).toHaveFocus();
  });

  it("opens selected file with Enter", async () => {
    render(<FileSearchUtilityPanel commandQuery="report" />);

    await screen.findByText("report.txt");
    const listContainer = getListContainerFromResultText("report.txt");
    listContainer.focus();

    fireEvent.keyDown(listContainer, { key: "Enter" });

    await waitFor(() => {
      expect(invokePanelCommandMock).toHaveBeenCalledWith(expect.anything(), "open_file_path", {
        path: "C:/Users/ardev/Documents/report.txt",
        reveal: false,
      });
    });
  });

  it("reveals selected file with Shift+Enter", async () => {
    render(<FileSearchUtilityPanel commandQuery="report" />);

    await screen.findByText("report.txt");
    const listContainer = getListContainerFromResultText("report.txt");
    listContainer.focus();

    fireEvent.keyDown(listContainer, { key: "Enter", shiftKey: true });

    await waitFor(() => {
      expect(invokePanelCommandMock).toHaveBeenCalledWith(expect.anything(), "open_file_path", {
        path: "C:/Users/ardev/Documents/report.txt",
        reveal: true,
      });
    });
  });

  it("returns focus to launcher input on ArrowUp from first item", async () => {
    const focusLauncherInput = vi.fn();

    render(<FileSearchUtilityPanel commandQuery="report" focusLauncherInput={focusLauncherInput} />);

    await screen.findByText("report.txt");
    const listContainer = getListContainerFromResultText("report.txt");
    listContainer.focus();

    fireEvent.keyDown(listContainer, { key: "ArrowUp" });

    expect(focusLauncherInput).toHaveBeenCalledTimes(1);
  });
});
