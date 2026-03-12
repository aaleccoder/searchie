import type { CorePluginDescriptor } from "@/lib/plugin-contract";
import { createCoreAppsPlugin } from "@/plugins/core/apps";
import { createCoreClipboardPlugin } from "@/plugins/core/clipboard";
import { createCoreSettingsSearchPlugin } from "@/plugins/core/settings-search";
import { createCoreSystemPlugin } from "@/plugins/core/system";
import { createCoreUtilitiesPlugin } from "@/plugins/core/utilities";

export function buildCorePlugins(): CorePluginDescriptor[] {
  return [
    createCoreAppsPlugin(),
    createCoreSettingsSearchPlugin(),
    createCoreClipboardPlugin(),
    createCoreUtilitiesPlugin(),
    createCoreSystemPlugin(),
  ];
}
