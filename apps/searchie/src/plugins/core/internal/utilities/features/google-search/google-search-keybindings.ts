import type { PanelInputKeyDownHandler } from "@/lib/panel-contract";

type GoogleSearchInputController = {
  moveSelection: (delta: number) => boolean;
  activateSelection: () => boolean;
};

let currentController: GoogleSearchInputController | null = null;

export function registerGoogleSearchInputController(controller: GoogleSearchInputController | null): void {
  currentController = controller;
}

export const onGoogleSearchInputKeyDown: PanelInputKeyDownHandler = (event) => {
  if (!currentController) {
    return false;
  }

  if (event.key === "ArrowUp") {
    return currentController.moveSelection(-1);
  }

  if (event.key === "ArrowDown") {
    return currentController.moveSelection(1);
  }

  if (event.key === "Enter") {
    return currentController.activateSelection();
  }

  return false;
};
