function isInspectorShortcut(event: KeyboardEvent): boolean {
  if (event.key === "F12") {
    return true;
  }

  const key = event.key.toLowerCase();
  return (event.ctrlKey || event.metaKey) && event.shiftKey && !event.altKey && key === "i";
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
    return true;
  }

  return target.isContentEditable;
}

function shouldBlockShortcut(event: KeyboardEvent): boolean {
  if (isInspectorShortcut(event)) {
    return false;
  }

  if (event.key === "F5" || event.key === "BrowserBack" || event.key === "BrowserForward") {
    return true;
  }

  if (event.altKey && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
    return true;
  }

  const key = event.key.toLowerCase();
  const hasCtrlOrMeta = event.ctrlKey || event.metaKey;
  if (hasCtrlOrMeta && ["r", "p", "n", "t", "w", "+", "-", "=", "0"].includes(key)) {
    return true;
  }

  if (event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey && key.length === 1) {
    return !isEditableTarget(event.target);
  }

  return false;
}

export function installWebviewInputGuard(): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    if (!shouldBlockShortcut(event)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
  };

  const onContextMenu = (event: MouseEvent) => {
    event.preventDefault();
  };

  window.addEventListener("keydown", onKeyDown, { capture: true });
  window.addEventListener("contextmenu", onContextMenu);

  return () => {
    window.removeEventListener("keydown", onKeyDown, { capture: true });
    window.removeEventListener("contextmenu", onContextMenu);
  };
}
