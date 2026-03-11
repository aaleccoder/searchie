import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { GlyphPickerUtilityPanel } from "@/components/panels/utilities/glyph-picker-utility-panel";

vi.mock("@/lib/utilities/glyph-picker-engine", async () => {
  const actual = await vi.importActual<typeof import("@/lib/utilities/glyph-picker-engine")>(
    "@/lib/utilities/glyph-picker-engine",
  );
  return {
    ...actual,
    loadEmojiEntriesFromUnicodeData: vi.fn(async () => []),
  };
});

describe("GlyphPickerUtilityPanel footer", () => {
  it("registers footer actions and runs primary + extra actions", async () => {
    const user = userEvent.setup();
    const registerPanelFooter = vi.fn();
    const writeText = vi.fn(async () => undefined);

    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: {
        writeText,
      },
    });

    render(
      <GlyphPickerUtilityPanel
        commandQuery="emoji grin"
        registerPanelFooter={registerPanelFooter}
        focusLauncherInput={vi.fn()}
      />,
    );

    const footer = registerPanelFooter.mock.calls[registerPanelFooter.mock.calls.length - 1]?.[0];
    expect(footer?.panel?.title).toBe("Glyph Picker");
    expect(footer?.primaryAction?.id).toBe("copy-glyph");

    await footer?.primaryAction?.onSelect();
    expect(writeText).toHaveBeenCalled();

    const copyLabel = footer?.extraActions?.find((action: { id: string }) => action.id === "copy-label");
    expect(copyLabel).toBeDefined();
    await copyLabel?.onSelect();

    expect(writeText).toHaveBeenCalled();
    expect(screen.getByText(/Glyph Picker/i)).toBeInTheDocument();
    await user.click(screen.getAllByRole("button")[0]!);
  });
});
