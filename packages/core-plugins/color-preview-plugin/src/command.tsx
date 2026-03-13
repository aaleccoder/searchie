import * as React from "react";
import {
  PanelCode,
  PanelContainer,
  PanelFlex,
  PanelGrid,
  PanelHeading,
  PanelParagraph,
  PanelSection,
  PanelText,
} from "sdk";

type ColorPreviewCommandProps = {
  commandQuery?: string;
  rawQuery?: string;
};

type ParsedColor = {
  normalized: string;
  label: string;
  cssColor: string;
};

const EXAMPLE_COLORS = ["#7c3aed", "rgb(34 197 94)", "hsl(12 76% 61%)", "tomato"];

export default function ColorPreviewCommand({ commandQuery = "", rawQuery = "" }: ColorPreviewCommandProps) {
  const query = commandQuery.trim() || rawQuery.trim();
  const parsed = parseColor(query);

  if (!query) {
    return (
      <PanelContainer surface="panel" padding="lg" className="h-full">
        <PanelFlex direction="col" gap="md" className="h-full justify-center">
          <PanelHeading level={2}>Color Preview</PanelHeading>
          <PanelParagraph tone="muted" size="md">
            Type a CSS color value after an alias like <PanelCode>color #7c3aed</PanelCode> or <PanelCode>rgb(34 197 94)</PanelCode>.
          </PanelParagraph>
          <PanelFlex gap="sm" className="flex-wrap">
            {EXAMPLE_COLORS.map((example) => (
              <ExampleChip key={example} value={example} />
            ))}
          </PanelFlex>
        </PanelFlex>
      </PanelContainer>
    );
  }

  if (!parsed) {
    return (
      <PanelContainer surface="panel" padding="lg" className="h-full">
        <PanelFlex direction="col" gap="md">
          <PanelHeading level={2}>Color Preview</PanelHeading>
          <PanelParagraph tone="muted">
            The current query does not look like a valid CSS color. Try hex, rgb, rgba, hsl, hsla, or a named color.
          </PanelParagraph>
          <PanelCode>{query}</PanelCode>
          <PanelFlex gap="sm" className="flex-wrap">
            {EXAMPLE_COLORS.map((example) => (
              <ExampleChip key={example} value={example} />
            ))}
          </PanelFlex>
        </PanelFlex>
      </PanelContainer>
    );
  }

  const foreground = getReadableForeground(parsed.cssColor);

  return (
    <PanelGrid columns="two-pane" gap="lg" className="h-full">
      <PanelSection>
        <PanelContainer
          surface="panel"
          padding="lg"
          className="flex h-full flex-col justify-between overflow-hidden"
          style={{ background: parsed.cssColor, color: foreground, minHeight: 260 }}
        >
          <PanelFlex direction="col" gap="sm">
            <PanelText size="xs" weight="semibold" className="uppercase tracking-[0.28em] opacity-80">
              Live Preview
            </PanelText>
            <PanelHeading level={1}>{parsed.label}</PanelHeading>
            <PanelParagraph size="md" className="max-w-[28ch] opacity-90">
              This preview uses the exact CSS color string that the plugin resolved from the launcher query.
            </PanelParagraph>
          </PanelFlex>
          <PanelFlex direction="col" gap="xs">
            <PanelText size="xs" className="uppercase tracking-[0.24em] opacity-70">
              CSS Output
            </PanelText>
            <PanelCode className="rounded-md bg-black/15 px-3 py-2 text-sm backdrop-blur-sm">{parsed.cssColor}</PanelCode>
          </PanelFlex>
        </PanelContainer>
      </PanelSection>

      <PanelSection>
        <PanelContainer surface="muted" padding="lg" className="h-full">
          <PanelFlex direction="col" gap="md">
            <PanelHeading level={3}>Color Details</PanelHeading>
            <DetailRow label="Query" value={query} />
            <DetailRow label="Resolved" value={parsed.normalized} />
            <DetailRow label="Panel mode" value="panel" />
            <DetailRow label="Capabilities" value="none" />
            <PanelParagraph tone="muted">
              This example plugin stays inside the current SDK boundary. It only uses headless SDK primitives and local color parsing logic.
            </PanelParagraph>
            <PanelFlex direction="col" gap="xs">
              <PanelText size="xs" weight="semibold" className="uppercase tracking-[0.24em] text-muted-foreground">
                Examples
              </PanelText>
              <PanelFlex gap="sm" className="flex-wrap">
                {EXAMPLE_COLORS.map((example) => (
                  <ExampleChip key={example} value={example} />
                ))}
              </PanelFlex>
            </PanelFlex>
          </PanelFlex>
        </PanelContainer>
      </PanelSection>
    </PanelGrid>
  );
}

function ExampleChip({ value }: { value: string }) {
  return (
    <PanelText
      size="xs"
      className="rounded-full border border-border/60 bg-background/80 px-3 py-1 font-mono text-foreground"
    >
      {value}
    </PanelText>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <PanelFlex justify="between" gap="md" className="rounded-md border border-border/60 bg-background/55 px-3 py-2">
      <PanelText tone="muted" size="xs" weight="semibold" className="uppercase tracking-[0.2em]">
        {label}
      </PanelText>
      <PanelCode className="text-right text-sm">{value}</PanelCode>
    </PanelFlex>
  );
}

function parseColor(input: string): ParsedColor | null {
  const value = input.trim();
  if (!value) {
    return null;
  }

  if (isHexColor(value)) {
    const normalized = normalizeHexColor(value);
    return {
      normalized,
      label: normalized.toUpperCase(),
      cssColor: normalized,
    };
  }

  if (isFunctionalColor(value, "rgb") || isFunctionalColor(value, "rgba") || isFunctionalColor(value, "hsl") || isFunctionalColor(value, "hsla")) {
    return {
      normalized: squashWhitespace(value),
      label: value.split("(")[0]?.toUpperCase() ?? "COLOR",
      cssColor: value,
    };
  }

  if (isNamedColor(value)) {
    const normalized = value.toLowerCase();
    return {
      normalized,
      label: normalized,
      cssColor: normalized,
    };
  }

  return null;
}

function isHexColor(value: string): boolean {
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value);
}

function normalizeHexColor(value: string): string {
  const hex = value.toLowerCase();
  if (hex.length === 4 || hex.length === 5) {
    const prefix = hex.slice(0, 1);
    const digits = hex
      .slice(1)
      .split("")
      .map((digit) => `${digit}${digit}`)
      .join("");
    return `${prefix}${digits}`;
  }
  return hex;
}

function isFunctionalColor(value: string, fn: "rgb" | "rgba" | "hsl" | "hsla"): boolean {
  const pattern = new RegExp(`^${fn}\\((.+)\\)$`, "i");
  return pattern.test(value);
}

function isNamedColor(value: string): boolean {
  return /^[a-zA-Z]+$/.test(value);
}

function squashWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function getReadableForeground(color: string): string {
  const rgb = resolveRgb(color);
  if (!rgb) {
    return "#0f172a";
  }

  const [red, green, blue] = rgb;
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
  return luminance > 0.66 ? "#0f172a" : "#f8fafc";
}

function resolveRgb(color: string): [number, number, number] | null {
  if (isHexColor(color)) {
    const normalized = normalizeHexColor(color).slice(1, 7);
    const red = Number.parseInt(normalized.slice(0, 2), 16);
    const green = Number.parseInt(normalized.slice(2, 4), 16);
    const blue = Number.parseInt(normalized.slice(4, 6), 16);
    return [red, green, blue];
  }

  const rgbMatch = color.match(/^rgba?\((.+)\)$/i);
  if (rgbMatch) {
    const channels = rgbMatch[1]
      .replace(/\//g, " ")
      .split(/[\s,]+/)
      .filter(Boolean)
      .slice(0, 3)
      .map(parseRgbChannel);
    if (channels.length === 3 && channels.every((channel: number | null) => channel !== null)) {
      return channels as [number, number, number];
    }
    return null;
  }

  return NAMED_COLOR_RGB[color.toLowerCase()] ?? null;
}

function parseRgbChannel(token: string): number | null {
  if (token.endsWith("%")) {
    const percent = Number.parseFloat(token.slice(0, -1));
    if (Number.isNaN(percent)) {
      return null;
    }
    return Math.max(0, Math.min(255, Math.round((percent / 100) * 255)));
  }

  const value = Number.parseFloat(token);
  if (Number.isNaN(value)) {
    return null;
  }
  return Math.max(0, Math.min(255, Math.round(value)));
}

const NAMED_COLOR_RGB: Record<string, [number, number, number]> = {
  aliceblue: [240, 248, 255],
  black: [0, 0, 0],
  blue: [0, 0, 255],
  crimson: [220, 20, 60],
  cyan: [0, 255, 255],
  fuchsia: [255, 0, 255],
  gold: [255, 215, 0],
  gray: [128, 128, 128],
  green: [0, 128, 0],
  indigo: [75, 0, 130],
  lime: [0, 255, 0],
  magenta: [255, 0, 255],
  orange: [255, 165, 0],
  purple: [128, 0, 128],
  red: [255, 0, 0],
  royalblue: [65, 105, 225],
  slateblue: [106, 90, 205],
  teal: [0, 128, 128],
  tomato: [255, 99, 71],
  transparent: [255, 255, 255],
  white: [255, 255, 255],
  yellow: [255, 255, 0],
};
