import type { CorePluginDescriptor } from "@/lib/plugin-contract";
import { createCoreAppsPlugin } from "@/plugins/core/apps";
import { createCoreClipboardPlugin } from "@/plugins/core/clipboard";
import { createCoreSystemPlugin } from "@/plugins/core/system";
import { createCoreUtilitiesPlugin } from "@/plugins/core/utilities";

export function buildCorePlugins(): CorePluginDescriptor[] {
  return [
    createCoreAppsPlugin(),
    createCoreClipboardPlugin(),
    createCoreUtilitiesPlugin(),
    createCoreSystemPlugin(),
  ];
}
