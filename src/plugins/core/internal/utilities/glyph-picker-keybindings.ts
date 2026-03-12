import type { PanelInputKeyDownHandler } from "@/lib/panel-contract";

type GlyphPickerInputController = {
  moveSelection: (delta: number) => boolean;
  focusActions: () => boolean;
  focusList: () => boolean;
  activateSelection: () => boolean;
  focusLauncherInput: () => boolean;
};

let currentController: GlyphPickerInputController | null = null;

export function registerGlyphPickerInputController(controller: GlyphPickerInputController | null): void {
  currentController = controller;
}

export const onGlyphPickerInputKeyDown: PanelInputKeyDownHandler = (event) => {
  if (!currentController) {
    return false;
  }

  if (event.key === "ArrowUp") {
    return currentController.moveSelection(-1);
  }

  if (event.key === "ArrowDown") {
    return currentController.moveSelection(1);
  }

  if (event.key === "ArrowRight") {
    return currentController.focusActions();
  }

  if (event.key === "ArrowLeft") {
    return currentController.focusList();
  }

  if (event.key === "Enter") {
    return currentController.activateSelection();
  }

  if (event.key === "Escape") {
    return currentController.focusLauncherInput();
  }

  return false;
};
