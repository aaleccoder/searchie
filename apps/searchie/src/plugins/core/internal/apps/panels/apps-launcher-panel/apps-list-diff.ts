import type { InstalledApp } from "./types";

export function mergeAppsList(previous: InstalledApp[], next: InstalledApp[]): InstalledApp[] {
  if (previous.length === 0) {
    return [...next];
  }

  if (next.length === 0) {
    return [];
  }

  const nextById = new Map(next.map((app) => [app.id, app]));
  const merged: InstalledApp[] = [];
  const seen = new Set<string>();

  for (const current of previous) {
    const incoming = nextById.get(current.id);
    if (!incoming) {
      continue;
    }

    merged.push(incoming);
    seen.add(incoming.id);
  }

  for (const incoming of next) {
    if (seen.has(incoming.id)) {
      continue;
    }

    merged.push(incoming);
    seen.add(incoming.id);
  }

  return merged;
}
