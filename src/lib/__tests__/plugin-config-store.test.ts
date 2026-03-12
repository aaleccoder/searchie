import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ensurePluginConfigDefaults,
  getPluginConfigStoreFile,
  readPluginConfig,
  readPluginConfigSnapshot,
  registerPluginConfigDefinitions,
  resetPluginConfigRegistryForTests,
  writePluginConfig,
} from "@/lib/plugin-config-store";

type MemoryStore = {
  get: <T>(key: string) => Promise<T | undefined>;
  set: (key: string, value: unknown) => Promise<void>;
  save: () => Promise<void>;
};

const { loadMock } = vi.hoisted(() => ({
  loadMock: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-store", () => ({
  load: loadMock,
}));

describe("plugin-config-store", () => {
  const stores = new Map<string, Map<string, unknown>>();

  beforeEach(() => {
    stores.clear();
    resetPluginConfigRegistryForTests();

    loadMock.mockReset();
    loadMock.mockImplementation(async (file: string): Promise<MemoryStore> => {
      const bucket = stores.get(file) ?? new Map<string, unknown>();
      stores.set(file, bucket);

      return {
        get: async <T>(key: string) => bucket.get(key) as T | undefined,
        set: async (key: string, value: unknown) => {
          bucket.set(key, value);
        },
        save: async () => undefined,
      };
    });
  });

  it("creates plugin-specific store files", () => {
    expect(getPluginConfigStoreFile("Core.Plugin Alpha")).toBe("plugin-config.core.plugin_alpha.json");
  });

  it("applies defaults and persists values", async () => {
    registerPluginConfigDefinitions("plugin.alpha", [
      { key: "enabled", label: "Enabled", valueType: "boolean", defaultValue: true },
      {
        key: "mode",
        label: "Mode",
        valueType: { kind: "select", options: [{ label: "Safe", value: "safe" }] },
        defaultValue: "safe",
      },
    ]);

    await ensurePluginConfigDefaults("plugin.alpha");

    expect(await readPluginConfig("plugin.alpha", "enabled")).toBe(true);
    expect(await readPluginConfig("plugin.alpha", "mode")).toBe("safe");

    await writePluginConfig("plugin.alpha", "enabled", false);
    expect(await readPluginConfig("plugin.alpha", "enabled")).toBe(false);

    expect(await readPluginConfigSnapshot("plugin.alpha")).toEqual({
      enabled: false,
      mode: "safe",
    });
  });

  it("keeps plugin stores isolated", async () => {
    registerPluginConfigDefinitions("plugin.one", [
      { key: "value", label: "Value", valueType: "number", defaultValue: 1 },
    ]);
    registerPluginConfigDefinitions("plugin.two", [
      { key: "value", label: "Value", valueType: "number", defaultValue: 2 },
    ]);

    await ensurePluginConfigDefaults("plugin.one");
    await ensurePluginConfigDefaults("plugin.two");

    await writePluginConfig("plugin.one", "value", 11);

    expect(await readPluginConfig("plugin.one", "value")).toBe(11);
    expect(await readPluginConfig("plugin.two", "value")).toBe(2);
  });
});
