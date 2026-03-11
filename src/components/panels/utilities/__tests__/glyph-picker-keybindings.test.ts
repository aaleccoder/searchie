import { describe, expect, it, vi } from "vitest";
import {
  onGlyphPickerInputKeyDown,
  registerGlyphPickerInputController,
} from "@/components/panels/utilities/glyph-picker-keybindings";

function makeEvent(key: string): React.KeyboardEvent<HTMLInputElement> {
  return { key } as React.KeyboardEvent<HTMLInputElement>;
}

describe("onGlyphPickerInputKeyDown", () => {
  it("routes arrow keys, enter, and escape to current controller", () => {
    const controller = {
      moveSelection: vi.fn(() => true),
      focusActions: vi.fn(() => true),
      focusList: vi.fn(() => true),
      activateSelection: vi.fn(() => true),
      focusLauncherInput: vi.fn(() => true),
    };

    registerGlyphPickerInputController(controller);

    expect(onGlyphPickerInputKeyDown(makeEvent("ArrowDown"), { rawQuery: "", commandQuery: "" })).toBe(true);
    expect(onGlyphPickerInputKeyDown(makeEvent("ArrowUp"), { rawQuery: "", commandQuery: "" })).toBe(true);
    expect(onGlyphPickerInputKeyDown(makeEvent("ArrowRight"), { rawQuery: "", commandQuery: "" })).toBe(true);
    expect(onGlyphPickerInputKeyDown(makeEvent("ArrowLeft"), { rawQuery: "", commandQuery: "" })).toBe(true);
    expect(onGlyphPickerInputKeyDown(makeEvent("Enter"), { rawQuery: "", commandQuery: "" })).toBe(true);
    expect(onGlyphPickerInputKeyDown(makeEvent("Escape"), { rawQuery: "", commandQuery: "" })).toBe(true);

    expect(controller.moveSelection).toHaveBeenCalledWith(1);
    expect(controller.moveSelection).toHaveBeenCalledWith(-1);
    expect(controller.focusActions).toHaveBeenCalledTimes(1);
    expect(controller.focusList).toHaveBeenCalledTimes(1);
    expect(controller.activateSelection).toHaveBeenCalledTimes(1);
    expect(controller.focusLauncherInput).toHaveBeenCalledTimes(1);

    registerGlyphPickerInputController(null);
  });

  it("returns false when no controller exists", () => {
    registerGlyphPickerInputController(null);
    expect(onGlyphPickerInputKeyDown(makeEvent("ArrowDown"), { rawQuery: "", commandQuery: "" })).toBe(
      false,
    );
  });
});
