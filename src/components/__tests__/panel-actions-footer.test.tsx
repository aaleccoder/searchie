import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ClipboardList, Rocket } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { PanelActionsFooter } from "@/components/panel-actions-footer";

describe("PanelActionsFooter", () => {
  it("renders panel title/icon, Enter affordance, and Alt+K hint for More", async () => {
    const user = userEvent.setup();
    const runPrimary = vi.fn();
    const runExtra = vi.fn();

    render(
      <PanelActionsFooter
        footer={{
          panel: {
            title: "Clipboard",
            icon: ClipboardList,
          },
          primaryAction: {
            id: "open",
            label: "Open",
            icon: Rocket,
            onSelect: runPrimary,
          },
          extraActions: [
            {
              id: "delete",
              label: "Delete",
              onSelect: runExtra,
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("Clipboard")).toBeInTheDocument();
    expect(screen.getByTestId("footer-panel-icon")).toBeInTheDocument();

    const primaryButton = screen.getByRole("button", { name: /Open/i });
    expect(primaryButton).toBeInTheDocument();
    expect(screen.getByTestId("primary-enter-icon")).toBeInTheDocument();

    const moreButton = screen.getByRole("button", { name: /More/i });
    expect(moreButton).toHaveTextContent("Alt+K");

    await user.click(primaryButton);
    expect(runPrimary).toHaveBeenCalledTimes(1);

    await user.click(moreButton);
    await user.click(await screen.findByText("Delete"));
    expect(runExtra).toHaveBeenCalledTimes(1);
  });
});
