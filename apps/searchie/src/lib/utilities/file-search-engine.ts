export type ParsedFileSearchQuery = {
  term: string;
  rootPath?: string;
};

export type FileSearchRequest = {
  query: string;
  limit: number;
  root?: string;
};

export type FileSearchCandidate = {
  path: string;
  fileName: string;
};

export type RankedFileSearchCandidate = FileSearchCandidate & {
  score: number;
};

const DEFAULT_LIMIT = 64;
const MAX_LIMIT = 200;

function normalizeWindowsPath(raw: string): string {
  const trimmed = raw.trim().replace(/^"|"$/g, "");
  if (!trimmed) {
    return "";
  }
  return trimmed.replace(/[\\/]+$/, "");
}

export function parseFileSearchQuery(input: string): ParsedFileSearchQuery | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  const lower = trimmed.toLowerCase();
  const splitIndex = lower.lastIndexOf(" in ");

  if (splitIndex <= 0) {
    return { term: trimmed, rootPath: undefined };
  }

  const term = trimmed.slice(0, splitIndex).trim();
  const rootPath = normalizeWindowsPath(trimmed.slice(splitIndex + 4));

  if (!term) {
    return null;
  }

  return {
    term,
    rootPath: rootPath || undefined,
  };
}

export function buildSearchRequest(input: string, limit = DEFAULT_LIMIT): FileSearchRequest {
  const parsed = parseFileSearchQuery(input);
  if (!parsed) {
    throw new Error("Query is empty or invalid");
  }

  return {
    query: parsed.term,
    root: parsed.rootPath,
    limit: Math.max(1, Math.min(MAX_LIMIT, Math.floor(limit))),
  };
}

function scoreCandidate(query: string, candidate: FileSearchCandidate): number {
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) {
    return 0;
  }

  const fileNameLower = candidate.fileName.toLowerCase();
  const pathLower = candidate.path.toLowerCase();

  for (const token of tokens) {
    if (!pathLower.includes(token)) {
      return -1;
    }
  }

  let score = 0;
  const compactQuery = tokens.join("");

  if (fileNameLower === compactQuery) {
    score += 400;
  }

  if (fileNameLower.startsWith(compactQuery)) {
    score += 220;
  }

  if (fileNameLower.includes(compactQuery)) {
    score += 120;
  }

  for (const token of tokens) {
    if (fileNameLower.startsWith(token)) {
      score += 70;
    } else if (fileNameLower.includes(token)) {
      score += 32;
    }

    const segmentHit = pathLower.split(/[\\/]/).some((segment) => segment.startsWith(token));
    if (segmentHit) {
      score += 14;
    }
  }

  // Shorter paths are usually more likely to be user-visible roots.
  score += Math.max(0, 38 - Math.floor(candidate.path.length / 12));
  return score;
}

export function rankFileSearchResults(
  query: string,
  candidates: FileSearchCandidate[],
): RankedFileSearchCandidate[] {
  return candidates
    .map((candidate) => ({ ...candidate, score: scoreCandidate(query, candidate) }))
    .filter((candidate) => candidate.score >= 0)
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.path.localeCompare(b.path);
    });
}
