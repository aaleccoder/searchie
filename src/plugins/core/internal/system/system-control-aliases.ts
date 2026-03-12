import { flattenAliases, type LocalizedAliasMap } from "@/plugins/core/internal/utilities/aliases";

export const MEDIA_ALIASES: LocalizedAliasMap = {
  en: ["media", "playback", "music"],
};

export const VOLUME_ALIASES: LocalizedAliasMap = {
  en: ["volume", "sound", "audio"],
};

export const BRIGHTNESS_ALIASES: LocalizedAliasMap = {
  en: ["brightness", "bright", "screen"],
};

export const WIFI_ALIASES: LocalizedAliasMap = {
  en: ["wifi", "wi-fi", "wireless"],
};

export const BLUETOOTH_ALIASES: LocalizedAliasMap = {
  en: ["bluetooth", "bt"],
};

export const AIRPLANE_ALIASES: LocalizedAliasMap = {
  en: ["airplane", "flightmode", "airplanemode"],
};

export const HOTSPOT_ALIASES: LocalizedAliasMap = {
  en: ["hotspot", "mobilehotspot", "tether"],
};

export const POWER_ALIASES: LocalizedAliasMap = {
  en: ["power", "energy", "battery"],
};

export const SYSTEM_SETTINGS_ALIASES: LocalizedAliasMap = {
  en: ["systemsettings", "sysettings", "control"],
};

export const MEDIA_ALIAS_LIST = flattenAliases(MEDIA_ALIASES);
export const VOLUME_ALIAS_LIST = flattenAliases(VOLUME_ALIASES);
export const BRIGHTNESS_ALIAS_LIST = flattenAliases(BRIGHTNESS_ALIASES);
export const WIFI_ALIAS_LIST = flattenAliases(WIFI_ALIASES);
export const BLUETOOTH_ALIAS_LIST = flattenAliases(BLUETOOTH_ALIASES);
export const AIRPLANE_ALIAS_LIST = flattenAliases(AIRPLANE_ALIASES);
export const HOTSPOT_ALIAS_LIST = flattenAliases(HOTSPOT_ALIASES);
export const POWER_ALIAS_LIST = flattenAliases(POWER_ALIASES);
export const SYSTEM_SETTINGS_ALIAS_LIST = flattenAliases(SYSTEM_SETTINGS_ALIASES);
