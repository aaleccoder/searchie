import { describe, expect, it } from "vitest";
import { createPanelRegistry } from "@/lib/panel-registry";
import { buildUtilityPanels } from "../descriptors";

describe("utility panel registration", () => {
  it("registers utility panels with multilingual aliases", () => {
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

    expect(registry.find("emoji smile")?.panel.id).toBe("utilities-glyph-picker");
    expect(registry.find("emoticon shrug")?.panel.id).toBe("utilities-glyph-picker");
    expect(registry.find("else arrow")?.panel.id).toBe("utilities-glyph-picker");

    expect(registry.find("google maps")?.panel.id).toBe("utilities-google-search");
    expect(registry.find("gsearch weather")?.panel.id).toBe("utilities-google-search");
    expect(registry.find("rechercher music")?.panel.id).toBe("utilities-google-search");
  });
});
