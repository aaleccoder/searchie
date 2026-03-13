export type GlyphKind = "emoji" | "emoticon" | "symbol";

export type GlyphEntry = {
  id: string;
  value: string;
  label: string;
  kind: GlyphKind;
  tags: string[];
};

export type GlyphPickerQuery = {
  category: GlyphKind | "all";
  searchTerm: string;
};

let emojiEntriesCache: GlyphEntry[] | null = null;

const CATEGORY_ALIASES: Record<string, GlyphPickerQuery["category"]> = {
  emoji: "emoji",
  emoticon: "emoticon",
  kaomoji: "emoticon",
  symbol: "symbol",
  symbols: "symbol",
  else: "symbol",
  other: "symbol",
};

export const GLYPH_ENTRIES: GlyphEntry[] = [
  { id: "emoji-smile", value: "😊", label: "Smiling Face", kind: "emoji", tags: ["smile", "happy", "face"] },
  { id: "emoji-grin", value: "😁", label: "Grinning Face", kind: "emoji", tags: ["grin", "happy", "face"] },
  { id: "emoji-laugh", value: "😂", label: "Face with Tears of Joy", kind: "emoji", tags: ["laugh", "joy", "funny"] },
  { id: "emoji-wink", value: "😉", label: "Winking Face", kind: "emoji", tags: ["wink", "playful"] },
  { id: "emoji-heart-eyes", value: "😍", label: "Smiling Face with Heart Eyes", kind: "emoji", tags: ["love", "heart", "eyes"] },
  { id: "emoji-thinking", value: "🤔", label: "Thinking Face", kind: "emoji", tags: ["think", "hmm", "question"] },
  { id: "emoji-party", value: "🥳", label: "Partying Face", kind: "emoji", tags: ["party", "celebrate"] },
  { id: "emoji-fire", value: "🔥", label: "Fire", kind: "emoji", tags: ["fire", "hot", "lit"] },
  { id: "emoji-star", value: "⭐", label: "Star", kind: "emoji", tags: ["star", "favorite"] },
  { id: "emoji-thumbs-up", value: "👍", label: "Thumbs Up", kind: "emoji", tags: ["approve", "yes", "like"] },
  { id: "emoji-check", value: "✅", label: "Check Mark Button", kind: "emoji", tags: ["check", "done", "success"] },
  { id: "emoji-rocket", value: "🚀", label: "Rocket", kind: "emoji", tags: ["launch", "ship", "fast"] },
  { id: "emoticon-shrug", value: "¯\\_(ツ)_/¯", label: "Shrug", kind: "emoticon", tags: ["shrug", "idk", "dunno"] },
  { id: "emoticon-tableflip", value: "(╯°□°)╯︵ ┻━┻", label: "Table Flip", kind: "emoticon", tags: ["angry", "flip", "rage"] },
  { id: "emoticon-happy", value: "(＾▽＾)", label: "Happy Kaomoji", kind: "emoticon", tags: ["happy", "smile", "kaomoji"] },
  { id: "emoticon-cry", value: "(T_T)", label: "Crying Kaomoji", kind: "emoticon", tags: ["sad", "cry", "tear"] },
  { id: "emoticon-lenny", value: "( ͡° ͜ʖ ͡°)", label: "Lenny Face", kind: "emoticon", tags: ["lenny", "meme", "smirk"] },
  { id: "emoticon-cheers", value: "( ^_^)／□☆□＼(^_^ )", label: "Cheers", kind: "emoticon", tags: ["cheers", "celebrate"] },
  { id: "symbol-arrow-right", value: "->", label: "Arrow Right", kind: "symbol", tags: ["arrow", "right"] },
  { id: "symbol-arrow-double", value: "=>", label: "Arrow Double", kind: "symbol", tags: ["arrow", "implies"] },
  { id: "symbol-check", value: "[x]", label: "Checkbox Checked", kind: "symbol", tags: ["check", "todo"] },
  { id: "symbol-bullet", value: "*", label: "Bullet", kind: "symbol", tags: ["list", "bullet"] },
  { id: "symbol-section", value: "#", label: "Section Marker", kind: "symbol", tags: ["header", "section"] },
  { id: "symbol-diamond", value: "<>", label: "Diamond Brackets", kind: "symbol", tags: ["template", "angle"] },
  { id: "symbol-emdash", value: "--", label: "Em Dash ASCII", kind: "symbol", tags: ["dash", "separator"] },
  { id: "symbol-copyright", value: "(c)", label: "Copyright", kind: "symbol", tags: ["copyright", "legal"] },
];

function toEmojiGlyphEntry(value: string, label: string, tags: string[], index: number): GlyphEntry {
  return {
    id: `emoji-rgi-${index}-${value.codePointAt(0)?.toString(16) ?? "x"}`,
    value,
    label,
    kind: "emoji",
    tags,
  };
}

export async function loadEmojiEntriesFromUnicodeData(): Promise<GlyphEntry[]> {
  if (emojiEntriesCache) {
    return emojiEntriesCache;
  }

  try {
    const module = await import("@/lib/utilities/emoji-test-parser");
    const response = await fetch("/emoji-test.txt");
    if (!response.ok) {
      return [];
    }

    const raw = await response.text();
    const parsed = module.parseEmojiTestData(raw);
    const entries = parsed.map((entry, index) =>
      toEmojiGlyphEntry(entry.value, entry.label, entry.tags, index),
    );
    emojiEntriesCache = entries;
    return entries;
  } catch (error) {
    console.error("[glyph-picker] failed to load emoji-test.txt", error);
    return [];
  }
}

function resolveCategory(token: string): GlyphPickerQuery["category"] | null {
  return CATEGORY_ALIASES[token] ?? null;
}

export function parseGlyphPickerQuery(query: string): GlyphPickerQuery {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return { category: "all", searchTerm: "" };
  }

  const tokens = trimmed.split(/\s+/).filter(Boolean);
  const first = tokens[0] ?? "";
  const category = resolveCategory(first);
  if (!category) {
    return { category: "all", searchTerm: trimmed };
  }

  return {
    category,
    searchTerm: tokens.slice(1).join(" "),
  };
}

function scoreGlyphEntry(entry: GlyphEntry, tokens: string[]): number {
  if (tokens.length === 0) {
    return 1;
  }

  const haystack = `${entry.label} ${entry.tags.join(" ")} ${entry.value}`.toLowerCase();
  let score = 0;
  for (const token of tokens) {
    if (!haystack.includes(token)) {
      return -1;
    }

    if (entry.label.toLowerCase().startsWith(token)) {
      score += 40;
    } else if (entry.tags.some((tag) => tag.startsWith(token))) {
      score += 24;
    } else {
      score += 10;
    }
  }

  return score;
}

export function filterGlyphEntries(entries: GlyphEntry[], query: GlyphPickerQuery): GlyphEntry[] {
  const tokens = query.searchTerm.toLowerCase().split(/\s+/).filter(Boolean);

  return entries
    .filter((entry) => query.category === "all" || entry.kind === query.category)
    .map((entry) => ({ entry, score: scoreGlyphEntry(entry, tokens) }))
    .filter((result) => result.score >= 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.entry.label.localeCompare(right.entry.label);
    })
    .map((result) => result.entry)
    .slice(0, 100);
}
