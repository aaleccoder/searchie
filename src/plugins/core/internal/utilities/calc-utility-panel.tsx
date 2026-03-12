import * as React from "react";
import {
  Badge as PanelBadge,
  Input as PanelInput,
  PanelContainer,
  PanelHeading,
  PanelParagraph,
  PanelText,
} from "@/plugins/sdk";
import { evaluateExpression } from "@/lib/utilities/calc-engine";

type CalcUtilityPanelProps = {
  commandQuery: string;
};

export function CalcUtilityPanel({ commandQuery }: CalcUtilityPanelProps) {
  const [expression, setExpression] = React.useState(commandQuery);

  React.useEffect(() => {
    setExpression(commandQuery);
  }, [commandQuery]);

  const evaluation = React.useMemo(() => {
    try {
      if (!expression.trim()) {
        return { ok: false as const, message: "Type an expression like 2+2*3" };
      }
      const value = evaluateExpression(expression);
      return { ok: true as const, value };
    } catch (error) {
      return {
        ok: false as const,
        message: error instanceof Error ? error.message : "Invalid expression",
      };
    }
  }, [expression]);

  return (
    <PanelContainer className="h-full rounded-xl p-4 flex flex-col gap-4">
      <PanelContainer className="flex items-center justify-between">
        <PanelHeading>Calculator</PanelHeading>
        <PanelBadge variant="secondary">Utilities</PanelBadge>
      </PanelContainer>

      <PanelInput
        value={expression}
        onChange={(event) => setExpression(event.target.value)}
        placeholder="2 + 2 * 3"
      />

      <PanelContainer className="rounded-lg border border-border/60 bg-background/60 p-3">
        {evaluation.ok ? (
          <PanelParagraph>
            Result: <PanelText weight="semibold">{evaluation.value}</PanelText>
          </PanelParagraph>
        ) : (
          <PanelParagraph tone="muted">{evaluation.message}</PanelParagraph>
        )}
      </PanelContainer>

      <PanelParagraph size="xs" tone="muted">
        Supports +, -, *, / and parentheses.
      </PanelParagraph>
    </PanelContainer>
  );
}
