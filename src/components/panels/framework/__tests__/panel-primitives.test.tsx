import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PanelList } from "@/components/panels/framework/panel-primitives";

describe("PanelList", () => {
  it("keeps backward-compatible children rendering by default", () => {
    render(
      <PanelList data-testid="panel-list">
        <div>Static One</div>
        <div>Static Two</div>
      </PanelList>,
    );

    expect(screen.getByText("Static One")).toBeInTheDocument();
    expect(screen.getByText("Static Two")).toBeInTheDocument();
    expect(screen.getByTestId("panel-list")).toBeInTheDocument();
  });

  it("supports opt-in virtualization renderer", async () => {
    const renderItem = vi.fn((index: number) => <div key={index}>Row {index}</div>);

    render(
      <PanelList
        data-testid="virtual-panel-list"
        style={{ height: 220 }}
        virtualize={{
          count: 100,
          estimateSize: 40,
          overscan: 2,
          getItemKey: (index) => `row-${index}`,
          renderItem,
        }}
      />,
    );

    await waitFor(() => {
      expect(renderItem).toHaveBeenCalled();
      expect(screen.getByText("Row 0")).toBeInTheDocument();
    });
  });
});
