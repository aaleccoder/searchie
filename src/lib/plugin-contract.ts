import type { PanelCapability, ShortcutPanelDescriptor } from "@/lib/panel-contract";

export type PluginPermission = PanelCapability;

export type CorePluginDescriptor = {
  id: string;
  name: string;
  version: string;
  permissions: PluginPermission[];
  panels: ShortcutPanelDescriptor[];
};
