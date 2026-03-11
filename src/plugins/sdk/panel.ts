import type { ShortcutPanelDescriptor } from "@/lib/panel-contract";
import type { CorePluginDescriptor } from "@/lib/plugin-contract";

export function definePluginPanel(descriptor: ShortcutPanelDescriptor): ShortcutPanelDescriptor {
  return descriptor;
}

export function defineCorePlugin(descriptor: CorePluginDescriptor): CorePluginDescriptor {
  return descriptor;
}
