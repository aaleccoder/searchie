import type { CorePluginDescriptor } from "@/lib/plugin-contract";
import type { ColorUtilityManifest } from "@/plugins/core/internal/utilities/features/color";

type RuntimePluginModule = {
  manifest: ColorUtilityManifest;
  createRuntimePlugin: () => CorePluginDescriptor;
};

type RuntimePluginEntry = {
  importModule: () => Promise<RuntimePluginModule>;
};

const RUNTIME_PLUGIN_ENTRIES: RuntimePluginEntry[] = [
  {
    importModule: () => import("./modules/color-runtime-plugin"),
  },
];

function isValidManifestShape(manifest: ColorUtilityManifest): boolean {
  return Boolean(
    manifest.id?.trim() && manifest.name?.trim() && manifest.entry?.trim() && manifest.wasm?.path?.trim(),
  );
}

export async function loadRuntimePlugins(): Promise<CorePluginDescriptor[]> {
  const loaded: CorePluginDescriptor[] = [];

  for (const entry of RUNTIME_PLUGIN_ENTRIES) {
    try {
      const module = await entry.importModule();
      if (!isValidManifestShape(module.manifest)) {
        console.warn(`Skipping runtime plugin with invalid manifest: ${module.manifest.id}`);
        continue;
      }

      const plugin = module.createRuntimePlugin();
      if (plugin.id.trim()) {
        loaded.push(plugin);
      }
    } catch (error) {
      console.warn("Failed to load runtime plugin", error);
    }
  }

  return loaded;
}
