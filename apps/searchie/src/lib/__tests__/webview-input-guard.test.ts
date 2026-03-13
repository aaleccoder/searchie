import { describe, expect, it } from "vitest";
import { installWebviewInputGuard } from "@/lib/webview-input-guard";

function dispatchKeydown(target: EventTarget, init: KeyboardEventInit): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    ...init,
  });

  if (target instanceof HTMLElement) {
    target.dispatchEvent(event);
  } else {
    window.dispatchEvent(event);
  }

  return event;
}

describe("installWebviewInputGuard", () => {
  it("allows inspector shortcuts", () => {
    const cleanup = installWebviewInputGuard();

    const f12 = dispatchKeydown(window, { key: "F12" });
    const ctrlShiftI = dispatchKeydown(window, {
      key: "i",
      ctrlKey: true,
      shiftKey: true,
    });

    expect(f12.defaultPrevented).toBe(false);
    expect(ctrlShiftI.defaultPrevented).toBe(false);

    cleanup();
  });

  it("blocks dangerous webview shortcuts", () => {
    const cleanup = installWebviewInputGuard();

    const refresh = dispatchKeydown(window, { key: "r", ctrlKey: true });
    const reload = dispatchKeydown(window, { key: "F5" });

    expect(refresh.defaultPrevented).toBe(true);
    expect(reload.defaultPrevented).toBe(true);

    cleanup();
  });

  it("blocks shift+letter hotkeys outside text inputs", () => {
    const cleanup = installWebviewInputGuard();
    const target = document.createElement("div");
    document.body.appendChild(target);

    const event = dispatchKeydown(target, { key: "A", shiftKey: true });
    expect(event.defaultPrevented).toBe(true);

    target.remove();
    cleanup();
  });

  it("keeps uppercase typing in text inputs", () => {
    const cleanup = installWebviewInputGuard();
    const input = document.createElement("input");
    document.body.appendChild(input);

    const event = dispatchKeydown(input, { key: "A", shiftKey: true });
    expect(event.defaultPrevented).toBe(false);

    input.remove();
    cleanup();
  });

  it("disables right-click context menu", () => {
    const cleanup = installWebviewInputGuard();
    const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });

    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);

    cleanup();
  });
});