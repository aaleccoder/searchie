import { describe, expect, it } from "vitest";
import { loadRuntimePlugins } from "@/plugins/runtime";

describe("loadRuntimePlugins", () => {
  it("loads the runtime color plugin from manifest-backed module", async () => {
    const plugins = await loadRuntimePlugins();
    const colorPlugin = plugins.find((plugin) => plugin.id === "runtime.color");

    expect(colorPlugin).toBeDefined();
    expect(colorPlugin?.panels.some((panel) => panel.id === "utilities-color")).toBe(true);
  }, 15_000);
});
