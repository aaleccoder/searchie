import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PanelRegistryProvider } from "@/components/providers/panel-registry-provider";
import { usePanelRegistry } from "@/lib/panel-registry";

function Probe() {
  const registry = usePanelRegistry();
  const match = registry.find("cl test");
  return <div>{match?.panel.id ?? "none"}</div>;
}

describe("PanelRegistryProvider", () => {
  it("registers clipboard panel aliases", () => {
    render(
      <PanelRegistryProvider>
        <Probe />
      </PanelRegistryProvider>,
    );

    expect(screen.getByText("clipboard")).toBeInTheDocument();
  });
});
