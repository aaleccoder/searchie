import { defineCorePlugin } from "@/plugins/sdk";
import type { CorePluginDescriptor } from "@/lib/plugin-contract";

export function createCorePluginSettingsPlugin(): CorePluginDescriptor {
  return defineCorePlugin({
    id: "core.plugin-settings",
    name: "Core Plugin Settings",
    version: "0.1.0",
    permissions: [],
    panels: [],
    settings: (defineConfig) => [
      defineConfig("showPluginDiagnostics", "boolean", true, {
        label: "Show Plugin Diagnostics",
        description: "Show plugin diagnostics in debug views.",
        defaultValue: false,
      }),
      defineConfig("pluginTagline", "string", true, {
        label: "Plugin Tagline",
        description: "A short user-facing tagline for plugin demos.",
        defaultValue: "",
      }),
      defineConfig("pluginRetryCount", "number", true, {
        label: "Plugin Retry Count",
        description: "How many retries should be attempted by plugin demos.",
        defaultValue: 3,
      }),
      defineConfig(
        "pluginMode",
        {
          kind: "select",
          options: [
            { label: "Standard", value: "standard" },
            { label: "Aggressive", value: "aggressive" },
            { label: "Safe", value: "safe" },
          ],
        },
        true,
        {
          label: "Plugin Mode",
          description: "Select default operating mode for plugin demos.",
          defaultValue: "standard",
        },
      ),
    ],
  });
}
