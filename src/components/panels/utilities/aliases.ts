export type LocalizedAliasMap = Record<string, readonly string[]>;

export const CALC_ALIASES: LocalizedAliasMap = {
  en: ["calc", "calculate"],
  es: ["calcular"],
  fr: ["calculer"],
  de: ["rechnen"],
  it: ["calcola"],
  pt: ["calcular"],
};

export const CONVERSION_ALIASES: LocalizedAliasMap = {
  en: ["convert", "converter"],
  es: ["convertir"],
  fr: ["convertir"],
  de: ["umrechnen"],
  it: ["convertire"],
  pt: ["converter"],
};

export const FILE_SEARCH_ALIASES: LocalizedAliasMap = {
  en: ["files", "find", "fsearch"],
  es: ["buscar"],
  fr: ["fichiers"],
  de: ["dateien"],
  it: ["file"],
  pt: ["arquivos"],
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
