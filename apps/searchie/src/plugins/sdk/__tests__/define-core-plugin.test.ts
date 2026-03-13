import { describe, expect, it } from "vitest";
import { defineCorePlugin } from "@/plugins/sdk/panel";

describe("defineCorePlugin settings builder", () => {
  it("builds typed settings via defineConfig helper", () => {
    const plugin = defineCorePlugin({
      id: "plugin.test",
      name: "Test Plugin",
      version: "0.1.0",
      permissions: [],
      panels: [],
      settings: (defineConfig) => [
        defineConfig("enabled", "boolean", false, { label: "Enabled", defaultValue: true }),
        defineConfig("mode", { kind: "select", options: [{ label: "A", value: "a" }] }, true, {
          label: "Mode",
          defaultValue: "a",
        }),
      ],
    });

    expect(plugin.settings).toEqual([
      {
        key: "enabled",
        valueType: "boolean",
        optional: false,
        label: "Enabled",
        description: undefined,
        defaultValue: true,
      },
      {
        key: "mode",
        valueType: {
          kind: "select",
          options: [{ label: "A", value: "a" }],
        },
        optional: true,
        label: "Mode",
        description: undefined,
        defaultValue: "a",
      },
    ]);
  });
});
