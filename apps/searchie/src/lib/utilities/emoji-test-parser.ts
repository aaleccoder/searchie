export type ParsedEmojiEntry = {
  value: string;
  label: string;
  group: string;
  subgroup: string;
  tags: string[];
};

const FULLY_QUALIFIED_MARKER = "; fully-qualified";

function normalizeTagToken(token: string): string {
  return token.toLowerCase().replace(/[^a-z0-9]+/g, "").trim();
}

function toTags(label: string, group: string, subgroup: string): string[] {
  const tokens = `${label} ${group} ${subgroup}`.split(/\s+/).map(normalizeTagToken).filter(Boolean);
  return [...new Set(tokens)];
}

export function parseEmojiTestData(raw: string): ParsedEmojiEntry[] {
  const lines = raw.split(/\r?\n/);
  const results: ParsedEmojiEntry[] = [];
  let currentGroup = "uncategorized";
  let currentSubgroup = "misc";

  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }

    if (line.startsWith("# group:")) {
      currentGroup = line.replace("# group:", "").trim().toLowerCase();
      continue;
    }

    if (line.startsWith("# subgroup:")) {
      currentSubgroup = line.replace("# subgroup:", "").trim().toLowerCase();
      continue;
    }

    if (!line.includes(FULLY_QUALIFIED_MARKER)) {
      continue;
    }

    const markerIndex = line.indexOf("#");
    if (markerIndex < 0) {
      continue;
    }

    const right = line.slice(markerIndex + 1).trim();
    const match = right.match(/^(\S+)\s+E\d+(?:\.\d+)?\s+(.+)$/);
    if (!match) {
      continue;
    }

    const [, value, label] = match;
    if (!value || !label) {
      continue;
    }

    results.push({
      value,
      label: label.trim(),
      group: currentGroup,
      subgroup: currentSubgroup,
      tags: toTags(label, currentGroup, currentSubgroup),
    });
  }

  return results;
}
