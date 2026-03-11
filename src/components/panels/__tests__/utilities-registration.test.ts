import { describe, expect, it } from "vitest";
import { buildUtilityPanels } from "@/components/panels/utilities";
import { createPanelRegistry } from "@/lib/panel-registry";

describe("utility panel registration", () => {
  it("registers calc, convert, and file-search panels with multilingual aliases", () => {
    const registry = createPanelRegistry();
    for (const panel of buildUtilityPanels()) {
      registry.register(panel);
    }

    expect(registry.find("calc 2+2")?.panel.id).toBe("utilities-calc");
    expect(registry.find("calcular 5*5")?.panel.id).toBe("utilities-calc");
    expect(registry.find("rechnen 8/2")?.panel.id).toBe("utilities-calc");

    expect(registry.find("convert 10 km to mi")?.panel.id).toBe("utilities-convert");
    expect(registry.find("convertir 10 km a mi")?.panel.id).toBe("utilities-convert");
    expect(registry.find("converter 100 c para f")?.panel.id).toBe("utilities-convert");

    expect(registry.find("files readme")?.panel.id).toBe("utilities-file-search");
    expect(registry.find("find report")?.panel.id).toBe("utilities-file-search");
    expect(registry.find("buscar factura")?.panel.id).toBe("utilities-file-search");
  });
});
