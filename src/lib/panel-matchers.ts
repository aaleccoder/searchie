import type { PanelMatcher } from "@/lib/panel-contract";

function normalizeAliases(aliases: string[]): string[] {
  return aliases
    .map((alias) => alias.trim().toLowerCase())
    .filter((alias) => alias.length > 0)
    .sort((a, b) => b.length - a.length);
}

export function createPrefixAliasMatcher(aliases: string[]): PanelMatcher {
  const normalizedAliases = normalizeAliases(aliases);

  return (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) {
      return { matches: false, commandQuery: "" };
    }

    const lower = trimmed.toLowerCase();

    for (const alias of normalizedAliases) {
      if (lower === alias) {
        return { matches: true, commandQuery: "" };
      }

      if (lower.startsWith(`${alias} `)) {
        const commandQuery = trimmed.slice(alias.length + 1).trim();
        return { matches: true, commandQuery };
      }
    }

    return { matches: false, commandQuery: "" };
  };
}
