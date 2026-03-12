export const GOOGLE_SEARCH_BASE_URL = "https://www.google.com/search";
export const GOOGLE_SUGGEST_BASE_URL = "https://suggestqueries.google.com/complete/search";

export function normalizeGoogleQuery(query: string): string {
  return query.trim();
}

export function buildGoogleSearchUrl(query: string): string {
  const normalized = normalizeGoogleQuery(query);
  return `${GOOGLE_SEARCH_BASE_URL}?q=${encodeURIComponent(normalized)}`;
}

export function buildGoogleSuggestUrl(query: string): string {
  const normalized = normalizeGoogleQuery(query);
  return `${GOOGLE_SUGGEST_BASE_URL}?client=firefox&q=${encodeURIComponent(normalized)}`;
}

export function parseGoogleSuggestResponse(payload: unknown): string[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  const suggestions = payload[1];
  if (!Array.isArray(suggestions)) {
    return [];
  }

  const cleaned = new Set<string>();
  for (const entry of suggestions) {
    if (typeof entry !== "string") {
      continue;
    }
    const trimmed = entry.trim();
    if (trimmed) {
      cleaned.add(trimmed);
    }
  }

  return [...cleaned];
}
