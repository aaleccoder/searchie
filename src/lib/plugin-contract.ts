import type { PanelCapability, ShortcutPanelDescriptor } from "@/lib/panel-contract";

export type PluginPermission = PanelCapability;

export type PluginConfigOption = {
  label: string;
  value: string;
};

export type PluginConfigValueType =
  | "boolean"
  | "string"
  | "number"
  | {
      kind: "select";
      options: PluginConfigOption[];
    };

export type PluginConfigValue = boolean | string | number;

export type PluginConfigDefinition = {
  key: string;
  label: string;
  description?: string;
  optional?: boolean;
  valueType: PluginConfigValueType;
  defaultValue?: PluginConfigValue;
};

export type CorePluginDescriptor = {
  id: string;
  name: string;
  version: string;
  permissions: PluginPermission[];
  panels: ShortcutPanelDescriptor[];
  settings?: PluginConfigDefinition[];
};
