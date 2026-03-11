import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
    <div className="h-full rounded-xl border border-border/70 bg-card/92 p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Calculator</h3>
        <Badge variant="secondary">Utilities</Badge>
      </div>

      <Input
        value={expression}
        onChange={(event) => setExpression(event.target.value)}
        placeholder="2 + 2 * 3"
      />

      <div className="rounded-lg border border-border/60 bg-background/60 p-3">
        {evaluation.ok ? (
          <p className="text-sm">
            Result: <span className="font-semibold">{evaluation.value}</span>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">{evaluation.message}</p>
        )}
      </div>

      <p className="text-xs text-muted-foreground">Supports +, -, *, / and parentheses.</p>
    </div>
  );
}
