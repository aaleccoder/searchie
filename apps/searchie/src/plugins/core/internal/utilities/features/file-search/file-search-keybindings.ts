import type { PanelInputKeyDownHandler } from "@/lib/panel-contract";

type FileSearchInputController = {
  moveSelection: (delta: number) => boolean;
  focusActions: () => boolean;
  focusList: () => boolean;
  moveActionSelection: (delta: number) => boolean;
  activateSelection: (reveal: boolean) => boolean;
  inActions: () => boolean;
};

let currentController: FileSearchInputController | null = null;

export function registerFileSearchInputController(controller: FileSearchInputController | null): void {
  currentController = controller;
}

export const onFileSearchInputKeyDown: PanelInputKeyDownHandler = (event) => {
  if (!currentController) {
    return false;
  }

  const isActionMode = currentController.inActions();

  if (event.key === "ArrowUp") {
    return isActionMode
      ? currentController.moveActionSelection(-1)
      : currentController.moveSelection(-1);
  }

  if (event.key === "ArrowDown") {
    return isActionMode
      ? currentController.moveActionSelection(1)
      : currentController.moveSelection(1);
  }

  if (event.key === "Enter") {
    return currentController.activateSelection(event.shiftKey);
  }

  if (event.key === "ArrowRight") {
    return currentController.focusActions();
  }

  if (event.key === "ArrowLeft") {
    return currentController.focusList();
  }

  return false;
};
