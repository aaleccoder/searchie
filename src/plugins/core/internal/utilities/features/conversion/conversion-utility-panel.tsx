import * as React from "react";
import {
  Badge as PanelBadge,
  PanelFlex,
  Input as PanelInput,
  PanelContainer,
  PanelHeading,
  PanelParagraph,
  PanelText,
} from "@/plugins/sdk";
import { convertValue, parseConversionQuery } from "@/lib/utilities/conversion-engine";

type ConversionUtilityPanelProps = {
  commandQuery: string;
};

function formatNumber(value: number): string {
  if (Number.isInteger(value)) {
    return value.toString();
  }
  return value.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}

export function ConversionUtilityPanel({ commandQuery }: ConversionUtilityPanelProps) {
  const [query, setQuery] = React.useState(commandQuery);

  React.useEffect(() => {
    setQuery(commandQuery);
  }, [commandQuery]);

  const conversion = React.useMemo(() => {
    const parsed = parseConversionQuery(query);
    if (!parsed) {
      return {
        ok: false as const,
        message: "Use format: 10 km to mi (also supports: a, para, en)",
      };
    }

    try {
      const result = convertValue(parsed);
      return {
        ok: true as const,
        result,
        fromLabel: `${parsed.value} ${parsed.fromUnit}`,
        toLabel: `${formatNumber(result)} ${parsed.toUnit}`,
      };
    } catch (error) {
      return {
        ok: false as const,
        message: error instanceof Error ? error.message : "Unsupported conversion",
      };
    }
  }, [query]);

  return (
    <PanelContainer
      padding="lg"
      radius="lg"
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
      }}
    >
      <PanelFlex align="center" justify="between">
        <PanelHeading>Converter</PanelHeading>
        <PanelBadge variant="secondary">Utilities</PanelBadge>
      </PanelFlex>

      <PanelInput
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="10 km to mi"
      />

      <PanelContainer
        padding="md"
        radius="lg"
        style={{
          border: "1px solid color-mix(in oklab, hsl(var(--border)) 60%, transparent)",
          backgroundColor: "color-mix(in oklab, hsl(var(--background)) 60%, transparent)",
        }}
      >
        {conversion.ok ? (
          <PanelParagraph>
            {conversion.fromLabel} = <PanelText weight="semibold">{conversion.toLabel}</PanelText>
          </PanelParagraph>
        ) : (
          <PanelParagraph tone="muted">{conversion.message}</PanelParagraph>
        )}
      </PanelContainer>

      <PanelParagraph size="xs" tone="muted">
        Supports length, weight, and temperature conversions.
      </PanelParagraph>
    </PanelContainer>
  );
}
