import * as React from "react";
import {
  Badge as PanelBadge,
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
    <PanelContainer className="h-full rounded-xl p-4 flex flex-col gap-4">
      <PanelContainer className="flex items-center justify-between">
        <PanelHeading>Converter</PanelHeading>
        <PanelBadge variant="secondary">Utilities</PanelBadge>
      </PanelContainer>

      <PanelInput
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="10 km to mi"
      />

      <PanelContainer className="rounded-lg border border-border/60 bg-background/60 p-3">
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
