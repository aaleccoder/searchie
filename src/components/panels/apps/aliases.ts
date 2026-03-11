export type LocalizedAliasMap = Record<string, readonly string[]>;

export const APPS_ALIASES: LocalizedAliasMap = {
  en: ["apps", "app", "launch", "open"],
  es: ["aplicaciones"],
  fr: ["applications"],
  de: ["apps"],
  it: ["applicazioni"],
  pt: ["aplicativos"],
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
