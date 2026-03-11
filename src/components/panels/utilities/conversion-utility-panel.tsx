import * as React from "react";
import { PanelBadge, PanelInput } from "@/components/panels/framework";
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
    <div className="h-full rounded-xl p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Converter</h3>
        <PanelBadge variant="secondary">Utilities</PanelBadge>
      </div>

      <PanelInput
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="10 km to mi"
      />

      <div className="rounded-lg border border-border/60 bg-background/60 p-3">
        {conversion.ok ? (
          <p className="text-sm">
            {conversion.fromLabel} = <span className="font-semibold">{conversion.toLabel}</span>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">{conversion.message}</p>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Supports length, weight, and temperature conversions.
      </p>
    </div>
  );
}
