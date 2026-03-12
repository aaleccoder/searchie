export type LocalizedAliasMap = Record<string, readonly string[]>;

export const SETTINGS_SEARCH_ALIASES: LocalizedAliasMap = {
  en: ["msettings", "wsettings"],
  es: ["configwin"],
  fr: ["parametreswin"],
  de: ["winsettings"],
};

export function flattenAliases(map: LocalizedAliasMap): string[] {
  const merged = new Set<string>();
  for (const aliases of Object.values(map)) {
    for (const alias of aliases) {
      const normalized = alias.trim().toLowerCase();
      if (normalized) {
        merged.add(normalized);
      }
    }
  }
  return [...merged];
}

export const SETTINGS_SEARCH_ALIAS_LIST = flattenAliases(SETTINGS_SEARCH_ALIASES);
