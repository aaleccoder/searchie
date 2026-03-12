import type { InstalledApp } from "./types";

export function supportsRunAsAdmin(app: InstalledApp): boolean {
  const source = app.source.toLowerCase();
  if (source === "uwp" || source === "startapps") {
    return false;
  }

  const launchPath = app.launchPath.toLowerCase();
  if (launchPath !== "explorer.exe") {
    return true;
  }

  return !app.launchArgs.some((arg) => arg.toLowerCase().includes("shell:appsfolder\\"));
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export function isEditableElement(element: Element | null): boolean {
  if (!element) {
    return false;
  }

  if (element instanceof HTMLTextAreaElement) {
    return true;
  }

  if (element instanceof HTMLInputElement) {
    const type = element.type.toLowerCase();
    return type !== "button" && type !== "checkbox" && type !== "radio";
  }

  if (element instanceof HTMLElement) {
    return element.isContentEditable;
  }

  return false;
}
