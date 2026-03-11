const HEX_COLOR_PATTERN = /#[\da-fA-F]{3,8}\b/g;
const FUNCTION_COLOR_PATTERN =
  /(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\([^()]{1,120}\)/gi;

function cleanColorToken(token: string): string {
  return token.trim().replace(/[.,;:!?]+$/, "");
}

function supportsCssColor(value: string): boolean {
  if (typeof CSS !== "undefined" && typeof CSS.supports === "function") {
    return CSS.supports("color", value);
  }
  return false;
}

export function extractFirstColorToken(input: string): string | null {
  if (!input.trim()) {
    return null;
  }

  const candidates = [
    ...(input.match(HEX_COLOR_PATTERN) ?? []),
    ...(input.match(FUNCTION_COLOR_PATTERN) ?? []),
  ];

  for (const candidate of candidates) {
    const normalized = cleanColorToken(candidate);
    if (supportsCssColor(normalized)) {
      return normalized;
    }
  }

  return null;
}
