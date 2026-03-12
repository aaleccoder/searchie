import type { ShortcutPanelDescriptor } from "@/lib/panel-contract";
import type {
  CorePluginDescriptor,
  PluginConfigDefinition,
  PluginConfigValue,
  PluginConfigValueType,
} from "@/lib/plugin-contract";

type DefineConfigOptions = {
  label?: string;
  description?: string;
  defaultValue?: PluginConfigValue;
};

type DefineConfig = (
  key: string,
  valueType: PluginConfigValueType,
  optional?: boolean,
  options?: DefineConfigOptions,
) => PluginConfigDefinition;

type CorePluginWithSettingsBuilder = Omit<CorePluginDescriptor, "settings"> & {
  settings?: PluginConfigDefinition[] | ((defineConfig: DefineConfig) => PluginConfigDefinition[]);
};

export function definePluginPanel(descriptor: ShortcutPanelDescriptor): ShortcutPanelDescriptor {
  return descriptor;
}

function createDefineConfig(): DefineConfig {
  return (key, valueType, optional = false, options) => ({
    key,
    valueType,
    optional,
    label: options?.label ?? key,
    description: options?.description,
    defaultValue: options?.defaultValue,
  });
}

export function defineCorePlugin(descriptor: CorePluginWithSettingsBuilder): CorePluginDescriptor {
  const defineConfig = createDefineConfig();
  const settings =
    typeof descriptor.settings === "function" ? descriptor.settings(defineConfig) : (descriptor.settings ?? []);

  return {
    ...descriptor,
    settings,
  };
}
