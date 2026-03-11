import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClipboardPanel } from "@/components/clipboard-panel";

const { invokePanelCommandMock, openUrlMock, listenMock } = vi.hoisted(() => ({
  invokePanelCommandMock: vi.fn(),
  openUrlMock: vi.fn(),
  listenMock: vi.fn(),
}));

type ClipboardEntry = {
  id: string;
  kind: "text" | "image" | "files" | "other";
  preview: string;
  text?: string | null;
  imageBase64?: string | null;
  files: string[];
  formats: string[];
  createdAt: number;
  pinned?: boolean;
};

vi.mock("@/lib/tauri-commands", () => ({
  invokePanelCommand: invokePanelCommandMock,
}));

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: openUrlMock,
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: listenMock,
}));

const entries: ClipboardEntry[] = [
  {
    id: "clip-1",
    kind: "text",
    preview: "Read this https://example.com",
    text: "Read this https://example.com",
    files: [],
    formats: ["text/plain"],
    createdAt: Date.now(),
    pinned: false,
  },
  {
    id: "clip-2",
    kind: "text",
    preview: "Second entry",
    text: "Second entry",
    files: [],
    formats: ["text/plain"],
    createdAt: Date.now() - 10,
    pinned: false,
  },
];

let clipboardWriteTextMock: ReturnType<typeof vi.fn>;
let clipboardWriteMock: ReturnType<typeof vi.fn>;

function setupClipboardMocks() {
  clipboardWriteTextMock = vi.fn(async () => undefined);
  clipboardWriteMock = vi.fn(async () => undefined);

  Object.defineProperty(window.navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: clipboardWriteTextMock,
      write: clipboardWriteMock,
    },
  });
}

describe("ClipboardPanel hotkeys", () => {
  beforeEach(() => {
    setupClipboardMocks();
    invokePanelCommandMock.mockReset();
    openUrlMock.mockReset();
    listenMock.mockReset();

    listenMock.mockImplementation(async () => () => undefined);
    invokePanelCommandMock.mockImplementation(async (_scope: unknown, command: string) => {
      if (command === "search_clipboard_history") {
        return entries;
      }
      if (command === "toggle_clipboard_pin") {
        return null;
      }
      return null;
    });
  });

  it("copies selected entry with Enter", async () => {
    render(<ClipboardPanel commandQuery="" />);

    await screen.findByText("Second entry");
    fireEvent.keyDown(document, { key: "Enter" });

    await waitFor(() => {
      expect(clipboardWriteTextMock).toHaveBeenCalledWith("Read this https://example.com");
    });
  });

  it("cycles content filter with Mod+P", async () => {
    const user = userEvent.setup();
    render(<ClipboardPanel commandQuery="" />);

    await screen.findByText("Second entry");
    await user.keyboard("{Control>}p{/Control}");

    await waitFor(() => {
      expect(invokePanelCommandMock).toHaveBeenCalledWith(
        expect.anything(),
        "search_clipboard_history",
        expect.objectContaining({ kind: "text" }),
      );
    });
  });

  it("opens selected entry link with Mod+O", async () => {
    const user = userEvent.setup();
    render(<ClipboardPanel commandQuery="" />);

    await screen.findByText("Second entry");
    await user.keyboard("{Control>}o{/Control}");

    await waitFor(() => {
      expect(openUrlMock).toHaveBeenCalledWith("https://example.com");
    });
  });

  it("toggles selected entry pin with Mod+Shift+P", async () => {
    const user = userEvent.setup();
    render(<ClipboardPanel commandQuery="" />);

    await screen.findByText("Second entry");
    await user.keyboard("{Control>}{Shift>}p{/Shift}{/Control}");

    await waitFor(() => {
      expect(invokePanelCommandMock).toHaveBeenCalledWith(
        expect.anything(),
        "toggle_clipboard_pin",
        { id: "clip-1" },
      );
    });
  });

  it("removes selected entry with Ctrl+X", async () => {
    const user = userEvent.setup();
    render(<ClipboardPanel commandQuery="" />);

    await screen.findByText("Second entry");
    await user.keyboard("{Control>}x{/Control}");

    await waitFor(() => {
      expect(invokePanelCommandMock).toHaveBeenCalledWith(
        expect.anything(),
        "delete_clipboard_entry",
        { id: "clip-1" },
      );
    });
  });

  it("clears all clipboard entries with Ctrl+Shift+X", async () => {
    const user = userEvent.setup();
    render(<ClipboardPanel commandQuery="" />);

    await screen.findByText("Second entry");
    await user.keyboard("{Control>}{Shift>}x{/Shift}{/Control}");

    await waitFor(() => {
      expect(invokePanelCommandMock).toHaveBeenCalledWith(
        expect.anything(),
        "clear_clipboard_history",
        {},
      );
    });
  });

  it("moves selection with arrow keys while textarea is focused", async () => {
    render(<ClipboardPanel commandQuery="" />);

    await screen.findByText("Second entry");
    const firstItem = screen.getByRole("button", {
      name: /Read this https:\/\/example\.com/i,
    });
    firstItem.focus();
    expect(firstItem).toHaveFocus();

    fireEvent.keyDown(document, { key: "ArrowDown" });
    expect(firstItem).toHaveAttribute("aria-selected", "false");

    const secondItem = screen.getByRole("button", { name: /Second entry/i });
    expect(secondItem).toHaveAttribute("aria-selected", "true");
  });

  it("moves selection with arrow keys even when panel has no focused element", async () => {
    render(<ClipboardPanel commandQuery="" />);

    await screen.findByText("Second entry");
    document.body.focus();

    fireEvent.keyDown(document, { key: "ArrowDown" });

    const secondItem = screen.getByRole("button", { name: /Second entry/i });
    expect(secondItem).toHaveAttribute("aria-selected", "true");
  });

  it("clears launcher input when clicking a clipboard item", async () => {
    const clearLauncherInput = vi.fn();
    render(<ClipboardPanel commandQuery="cl test" clearLauncherInput={clearLauncherInput} />);

    const firstItem = await screen.findByRole("button", {
      name: /Read this https:\/\/example\.com/i,
    });
    fireEvent.click(firstItem);

    expect(clearLauncherInput).toHaveBeenCalledTimes(1);
  });
});
