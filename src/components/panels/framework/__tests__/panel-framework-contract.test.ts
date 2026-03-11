import { describe, expect, it } from "vitest";
import { createPanelComponent, definePanel, isPanelFrameworkComponent } from "@/components/panels/framework";

describe("panel framework contract", () => {
  it("brands components created with createPanelComponent", () => {
    const component = createPanelComponent(() => null);
    expect(isPanelFrameworkComponent(component)).toBe(true);
  });

  it("definePanel wraps descriptor component with framework branding", () => {
    const descriptor = definePanel({
      id: "test-panel",
      name: "Test Panel",
      aliases: ["tp"],
      capabilities: [],
      matcher: () => ({ matches: true, commandQuery: "" }),
      component: () => null,
    });

    expect(isPanelFrameworkComponent(descriptor.component)).toBe(true);
  });
});
