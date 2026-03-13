import { describe, expect, it } from "vitest";
import { createPanelRegistry } from "@/lib/panel-registry";
import { buildUtilityPanels } from "../descriptors";

describe("google search panel descriptor", () => {
  it("registers google search panel and matches aliases", () => {
    const registry = createPanelRegistry();
    for (const panel of buildUtilityPanels()) {
      registry.register(panel);
    }

    expect(registry.find("google figma")?.panel.id).toBe("utilities-google-search");
    expect(registry.find("gsearch docs")?.panel.id).toBe("utilities-google-search");
    expect(registry.find("suchen music")?.panel.id).toBe("utilities-google-search");
  });
});
