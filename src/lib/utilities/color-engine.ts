export type ColorConversionResult = {
  hex: string;
  rgb: string;
  oklch: string;
  hsl: string;
  channels: {
    r: number;
    g: number;
    b: number;
  };
};

type RgbChannels = {
  r: number;
  g: number;
  b: number;
};

type Oklch = {
  l: number;
  c: number;
  h: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatNumber(value: number, digits: number): string {
  return value.toFixed(digits).replace(/0+$/, "").replace(/\.$/, "");
}

function normalizeHue(h: number): number {
  const wrapped = h % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

function parseHexChannels(input: string): RgbChannels | null {
  const match = input.trim().match(/^#([\da-f]{3}|[\da-f]{6})$/i);
  if (!match) {
    return null;
  }

  const value = match[1] ?? "";
  const normalized =
    value.length === 3
      ? `${value[0]}${value[0]}${value[1]}${value[1]}${value[2]}${value[2]}`
      : value;

  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);

  if ([r, g, b].some((channel) => !Number.isFinite(channel))) {
    return null;
  }

  return { r, g, b };
}

function parseRgbChannels(input: string): RgbChannels | null {
  const match = input.trim().match(/^rgba?\((.*)\)$/i);
  if (!match) {
    return null;
  }

  const payload = (match[1] ?? "").replace(/\//g, " ");
  const parts = payload
    .split(/[\s,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (parts.length < 3) {
    return null;
  }

  const [rawR, rawG, rawB] = parts;
  const r = Number.parseFloat(rawR ?? "");
  const g = Number.parseFloat(rawG ?? "");
  const b = Number.parseFloat(rawB ?? "");

  if (![r, g, b].every((channel) => Number.isFinite(channel) && channel >= 0 && channel <= 255)) {
    return null;
  }

  return {
    r: Math.round(r),
    g: Math.round(g),
    b: Math.round(b),
  };
}

function parseOklch(input: string): Oklch | null {
  const match = input.trim().match(/^oklch\((.*)\)$/i);
  if (!match) {
    return null;
  }

  const payload = (match[1] ?? "").replace(/\//g, " ");
  const numbers = payload.match(/-?\d*\.?\d+/g);
  if (!numbers || numbers.length < 3) {
    return null;
  }

  const lRaw = Number.parseFloat(numbers[0] ?? "");
  const c = Number.parseFloat(numbers[1] ?? "");
  const h = Number.parseFloat(numbers[2] ?? "");

  if (![lRaw, c, h].every((value) => Number.isFinite(value))) {
    return null;
  }

  const hasPercent = payload.includes("%");
  const l = hasPercent || lRaw > 1 ? lRaw / 100 : lRaw;
  if (l < 0 || l > 1 || c < 0) {
    return null;
  }

  return {
    l,
    c,
    h: normalizeHue(h),
  };
}

function srgbToLinear(value: number): number {
  const normalized = value / 255;
  if (normalized <= 0.04045) {
    return normalized / 12.92;
  }
  return ((normalized + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(value: number): number {
  const clamped = clamp(value, 0, 1);
  if (clamped <= 0.0031308) {
    return clamped * 12.92;
  }
  return 1.055 * clamped ** (1 / 2.4) - 0.055;
}

function rgbToOklch(channels: RgbChannels): Oklch {
  const r = srgbToLinear(channels.r);
  const g = srgbToLinear(channels.g);
  const b = srgbToLinear(channels.b);

  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

  const lRoot = Math.cbrt(l);
  const mRoot = Math.cbrt(m);
  const sRoot = Math.cbrt(s);

  const lValue = 0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot;
  const aValue = 1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot;
  const bValue = 0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot;

  const c = Math.sqrt(aValue ** 2 + bValue ** 2);
  const h = normalizeHue((Math.atan2(bValue, aValue) * 180) / Math.PI);

  return {
    l: clamp(lValue, 0, 1),
    c,
    h,
  };
}

function oklchToRgb(oklch: Oklch): RgbChannels {
  const a = oklch.c * Math.cos((oklch.h * Math.PI) / 180);
  const b = oklch.c * Math.sin((oklch.h * Math.PI) / 180);

  const lRoot = oklch.l + 0.3963377774 * a + 0.2158037573 * b;
  const mRoot = oklch.l - 0.1055613458 * a - 0.0638541728 * b;
  const sRoot = oklch.l - 0.0894841775 * a - 1.291485548 * b;

  const l = lRoot ** 3;
  const m = mRoot ** 3;
  const s = sRoot ** 3;

  const rLinear = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const gLinear = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bLinear = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  return {
    r: Math.round(clamp(linearToSrgb(rLinear) * 255, 0, 255)),
    g: Math.round(clamp(linearToSrgb(gLinear) * 255, 0, 255)),
    b: Math.round(clamp(linearToSrgb(bLinear) * 255, 0, 255)),
  };
}

function rgbToHsl(channels: RgbChannels): { h: number; s: number; l: number } {
  const r = channels.r / 255;
  const g = channels.g / 255;
  const b = channels.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const lightness = (max + min) / 2;

  if (delta === 0) {
    return { h: 0, s: 0, l: lightness * 100 };
  }

  const saturation =
    lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);

  let hue = 0;
  if (max === r) {
    hue = ((g - b) / delta + (g < b ? 6 : 0)) * 60;
  } else if (max === g) {
    hue = ((b - r) / delta + 2) * 60;
  } else {
    hue = ((r - g) / delta + 4) * 60;
  }

  return {
    h: normalizeHue(hue),
    s: saturation * 100,
    l: lightness * 100,
  };
}

function formatHex(channels: RgbChannels): string {
  const toHex = (value: number) => value.toString(16).toUpperCase().padStart(2, "0");
  return `#${toHex(channels.r)}${toHex(channels.g)}${toHex(channels.b)}`;
}

function formatRgb(channels: RgbChannels): string {
  return `rgb(${channels.r} ${channels.g} ${channels.b})`;
}

function formatOklch(oklch: Oklch): string {
  return `oklch(${formatNumber(oklch.l * 100, 1)}% ${formatNumber(oklch.c, 3)} ${formatNumber(oklch.h, 2)})`;
}

function formatHsl(channels: RgbChannels): string {
  const hsl = rgbToHsl(channels);
  return `hsl(${Math.round(hsl.h)} ${Math.round(hsl.s)}% ${Math.round(hsl.l)}%)`;
}

export function convertColorInput(input: string): ColorConversionResult | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  const rgbFromHex = parseHexChannels(trimmed);
  const rgbFromRgb = parseRgbChannels(trimmed);
  const oklch = parseOklch(trimmed);

  const channels = rgbFromHex ?? rgbFromRgb ?? (oklch ? oklchToRgb(oklch) : null);
  if (!channels) {
    return null;
  }

  const normalizedOklch = rgbToOklch(channels);

  return {
    hex: formatHex(channels),
    rgb: formatRgb(channels),
    oklch: formatOklch(normalizedOklch),
    hsl: formatHsl(channels),
    channels,
  };
}