globalThis.__searchieRuntimePluginFactory = function createColorPreviewRuntimePlugin(runtimeApi) {
  const React = runtimeApi.React;
  const {
    PanelCode,
    PanelContainer,
    PanelFlex,
    Grid,
    PanelHeading,
    PanelParagraph,
    PanelSection,
    PanelText,
  } = runtimeApi.sdk;

  const aliases = ["color", "hex", "rgb", "hsl"];
  const EXAMPLE_COLORS = ["#7c3aed", "rgb(34 197 94)", "hsl(12 76% 61%)", "tomato"];

  const NAMED_COLOR_RGB = {
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

  function isHexColor(value) {
    return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value);
  }

  function normalizeHexColor(value) {
    const hex = value.toLowerCase();
    if (hex.length === 4 || hex.length === 5) {
      const prefix = hex.slice(0, 1);
      const digits = hex
        .slice(1)
        .split("")
        .map(function duplicateDigit(digit) {
          return "".concat(digit).concat(digit);
        })
        .join("");
      return "".concat(prefix).concat(digits);
    }
    return hex;
  }

  function isFunctionalColor(value, fnName) {
    return new RegExp("^" + fnName + "\\((.+)\\)$", "i").test(value);
  }

  function isNamedColor(value) {
    return /^[a-zA-Z]+$/.test(value);
  }

  function squashWhitespace(value) {
    return value.replace(/\s+/g, " ").trim();
  }

  function parseRgbChannel(token) {
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

  function resolveRgb(color) {
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

      if (channels.length === 3 && channels.every(function valid(channel) { return channel !== null; })) {
        return channels;
      }

      return null;
    }

    return NAMED_COLOR_RGB[color.toLowerCase()] || null;
  }

  function getReadableForeground(color) {
    const rgb = resolveRgb(color);
    if (!rgb) {
      return "#0f172a";
    }

    const red = rgb[0];
    const green = rgb[1];
    const blue = rgb[2];
    const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
    return luminance > 0.66 ? "#0f172a" : "#f8fafc";
  }

  function parseColor(input) {
    const value = String(input || "").trim();
    if (!value) {
      return null;
    }

    if (/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value)) {
      const normalized = normalizeHexColor(value);
      return { label: normalized.toUpperCase(), normalized: normalized, cssColor: normalized };
    }

    if (
      isFunctionalColor(value, "rgb") ||
      isFunctionalColor(value, "rgba") ||
      isFunctionalColor(value, "hsl") ||
      isFunctionalColor(value, "hsla")
    ) {
      return {
        label: value.split("(")[0].toUpperCase(),
        normalized: squashWhitespace(value),
        cssColor: value,
      };
    }

    if (isNamedColor(value)) {
      const normalized = value.toLowerCase();
      return {
        label: normalized,
        normalized: normalized,
        cssColor: normalized,
      };
    }

    return null;
  }

  function ExampleChip(props) {
    return React.createElement(
      PanelText,
      {
        size: "xs",
        className: "rounded-full border border-border/60 bg-background/80 px-3 py-1 font-mono text-foreground",
      },
      props.value,
    );
  }

  function DetailRow(props) {
    return React.createElement(
      PanelFlex,
      {
        justify: "between",
        gap: "md",
        className: "rounded-md border border-border/60 bg-background/55 px-3 py-2",
      },
      React.createElement(
        PanelText,
        {
          tone: "muted",
          size: "xs",
          weight: "semibold",
          className: "uppercase tracking-[0.2em]",
        },
        props.label,
      ),
      React.createElement(PanelCode, { className: "text-right text-sm" }, props.value),
    );
  }

  function ColorPreviewPanel(props) {
    const commandQuery = (props && props.commandQuery) || "";
    const rawQuery = (props && props.rawQuery) || "";
    const query = String(commandQuery || rawQuery).trim();
    const parsed = parseColor(query);

    if (!query) {
      return React.createElement(
        PanelContainer,
        { surface: "panel", padding: "lg", className: "h-full" },
        React.createElement(
          PanelFlex,
          { direction: "col", gap: "md", className: "h-full justify-center" },
          React.createElement(PanelHeading, { level: 2 }, "Color Preview"),
          React.createElement(
            PanelParagraph,
            { tone: "muted", size: "md" },
            "Type a CSS color value after an alias like ",
            React.createElement(PanelCode, null, "color #7c3aed"),
            " or ",
            React.createElement(PanelCode, null, "rgb(34 197 94)"),
            "."
          ),
          React.createElement(
            PanelFlex,
            { gap: "sm", className: "flex-wrap" },
            EXAMPLE_COLORS.map(function renderExample(example) {
              return React.createElement(ExampleChip, { key: example, value: example });
            }),
          ),
        )
      );
    }

    if (!parsed) {
      return React.createElement(
        PanelContainer,
        { surface: "panel", padding: "lg", className: "h-full" },
        React.createElement(
          PanelFlex,
          { direction: "col", gap: "md" },
          React.createElement(PanelHeading, { level: 2 }, "Color Preview"),
          React.createElement(
            PanelParagraph,
            { tone: "muted" },
            "The current query does not look like a valid CSS color. Try hex, rgb, rgba, hsl, hsla, or a named color."
          ),
          React.createElement(PanelCode, null, query),
          React.createElement(
            PanelFlex,
            { gap: "sm", className: "flex-wrap" },
            EXAMPLE_COLORS.map(function renderExample(example) {
              return React.createElement(ExampleChip, { key: example, value: example });
            }),
          ),
        )
      );
    }

    const foreground = getReadableForeground(parsed.cssColor);

    return React.createElement(
      Grid,
      { columns: "two-pane", gap: "lg", className: "h-full" },
      React.createElement(
        PanelSection,
        null,
        React.createElement(
          PanelContainer,
          {
            surface: "panel",
            padding: "lg",
            className: "flex h-full flex-col justify-between overflow-hidden",
            style: { background: parsed.cssColor, color: foreground, minHeight: 260 },
          },
          React.createElement(
            PanelFlex,
            { direction: "col", gap: "sm" },
            React.createElement(
              PanelText,
              { size: "xs", weight: "semibold", className: "uppercase tracking-[0.28em] opacity-80" },
              "Live Preview"
            ),
            React.createElement(PanelHeading, { level: 1 }, parsed.label),
            React.createElement(
              PanelParagraph,
              { size: "md", className: "max-w-[28ch] opacity-90" },
              "This preview uses the exact CSS color string that the plugin resolved from the launcher query.",
            ),
          ),
          React.createElement(
            PanelFlex,
            { direction: "col", gap: "xs" },
            React.createElement(
              PanelText,
              { size: "xs", className: "uppercase tracking-[0.24em] opacity-70" },
              "CSS Output"
            ),
            React.createElement(
              PanelCode,
              { className: "rounded-md bg-black/15 px-3 py-2 text-sm backdrop-blur-sm" },
              parsed.cssColor,
            ),
          )
        )
      ),
      React.createElement(
        PanelSection,
        null,
        React.createElement(
          PanelContainer,
          { surface: "muted", padding: "lg", className: "h-full" },
          React.createElement(
            PanelFlex,
            { direction: "col", gap: "md" },
            React.createElement(PanelHeading, { level: 3 }, "Color Details"),
            React.createElement(DetailRow, { label: "Query", value: query }),
            React.createElement(DetailRow, { label: "Resolved", value: parsed.normalized }),
            React.createElement(DetailRow, { label: "Panel mode", value: "panel" }),
            React.createElement(DetailRow, { label: "Capabilities", value: "none" }),
            React.createElement(
              PanelParagraph,
              { tone: "muted" },
              "This plugin uses headless SDK primitives and local color parsing logic.",
            ),
            React.createElement(
              PanelFlex,
              { direction: "col", gap: "xs" },
              React.createElement(
                PanelText,
                {
                  size: "xs",
                  weight: "semibold",
                  className: "uppercase tracking-[0.24em] text-muted-foreground",
                },
                "Examples",
              ),
              React.createElement(
                PanelFlex,
                { gap: "sm", className: "flex-wrap" },
                EXAMPLE_COLORS.map(function renderExample(example) {
                  return React.createElement(ExampleChip, { key: example, value: example });
                }),
              ),
            ),
          )
        )
      )
    );
  }

  return {
    id: "runtime.color-preview",
    name: "Runtime Color Preview",
    version: "0.1.0",
    permissions: [],
    panels: [
      {
        id: "runtime-color-preview-panel",
        name: "color-preview",
        aliases: aliases,
        capabilities: [],
        matcher: runtimeApi.createPrefixAliasMatcher(aliases),
        searchIntegration: {
          activationMode: "immediate",
          placeholder: "Preview a color...",
          exitOnEscape: true,
        },
        component: function RuntimeColorPreviewComponent(props) {
          return React.createElement(ColorPreviewPanel, props);
        },
      },
    ],
  };
};
