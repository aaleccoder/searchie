export type SettingsCatalogRow = {
  settingsPage?: unknown;
  uri?: unknown;
};

export type SettingsSearchEntry = {
  id: string;
  settingsPage: string;
  uris: string[];
  searchText: string;
};

export type SettingsAliasQuery = {
  usedAlias: boolean;
  query: string;
};

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeUris(uriValue: unknown): string[] {
  if (typeof uriValue === "string") {
    const trimmed = uriValue.trim();
    return trimmed ? [trimmed] : [];
  }

  if (!Array.isArray(uriValue)) {
    return [];
  }

  const unique: string[] = [];
  for (const item of uriValue) {
    if (typeof item !== "string") {
      continue;
    }

    const trimmed = item.trim();
    if (!trimmed || unique.includes(trimmed)) {
      continue;
    }

    unique.push(trimmed);
  }

  return unique;
}

export function normalizeSettingsCatalog(payload: unknown): SettingsSearchEntry[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  const normalized: SettingsSearchEntry[] = [];

  payload.forEach((rawRow, index) => {
    const row = rawRow as SettingsCatalogRow;
    if (typeof row.settingsPage !== "string") {
      return;
    }

    const settingsPage = normalizeText(row.settingsPage);
    if (!settingsPage) {
      return;
    }

    const uris = normalizeUris(row.uri).filter((uri) => uri.toLowerCase().startsWith("ms-settings:"));
    if (uris.length === 0) {
      return;
    }

    normalized.push({
      id: `setting-${index}`,
      settingsPage,
      uris,
      searchText: `${settingsPage.toLowerCase()} ${uris.join(" ").toLowerCase()}`,
    });
  });

  return normalized;
}

export function extractSettingsAliasQuery(rawQuery: string, aliases: readonly string[]): SettingsAliasQuery {
  const trimmed = rawQuery.trim();
  if (!trimmed) {
    return { usedAlias: false, query: "" };
  }

  const [prefix, ...rest] = trimmed.split(/\s+/);
  const normalizedPrefix = prefix?.toLowerCase() ?? "";

  if (!aliases.some((alias) => alias.toLowerCase() === normalizedPrefix)) {
    return { usedAlias: false, query: trimmed };
  }

  return {
    usedAlias: true,
    query: rest.join(" ").trim(),
  };
}

export function scoreSettingsMatch(query: string, entry: SettingsSearchEntry): number {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return 1;
  }

  const page = entry.settingsPage.toLowerCase();
  const uriText = entry.uris.join(" ").toLowerCase();
  let score = 0;

  if (page === normalizedQuery) {
    score += 300;
  } else if (page.startsWith(normalizedQuery)) {
    score += 160;
  } else if (page.includes(normalizedQuery)) {
    score += 80;
  }

  if (uriText.includes(normalizedQuery)) {
    score += 70;
  }

  const queryTerms = normalizedQuery.split(/\s+/).filter(Boolean);
  for (const term of queryTerms) {
    if (page.includes(term)) {
      score += 20;
    }
    if (uriText.includes(term)) {
      score += 15;
    }
  }

  return score;
}

export function searchSettingsEntries(
  catalog: SettingsSearchEntry[],
  query: string,
  limit = 24,
): SettingsSearchEntry[] {
  if (!catalog.length) {
    return [];
  }

  const max = Math.max(1, limit);
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return catalog.slice(0, max);
  }

  return catalog
    .map((entry) => ({ entry, score: scoreSettingsMatch(normalizedQuery, entry) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return a.entry.settingsPage.localeCompare(b.entry.settingsPage);
    })
    .slice(0, max)
    .map((item) => item.entry);
}
