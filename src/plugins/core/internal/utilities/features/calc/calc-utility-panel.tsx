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
        <PanelHeading>Calculator</PanelHeading>
        <PanelBadge variant="secondary">Utilities</PanelBadge>
      </PanelFlex>

      <PanelInput
        value={expression}
        onChange={(event) => setExpression(event.target.value)}
        placeholder="2 + 2 * 3"
      />

      <PanelContainer
        padding="md"
        radius="lg"
        style={{
          border: "1px solid color-mix(in oklab, hsl(var(--border)) 60%, transparent)",
          backgroundColor: "color-mix(in oklab, hsl(var(--background)) 60%, transparent)",
        }}
      >
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
