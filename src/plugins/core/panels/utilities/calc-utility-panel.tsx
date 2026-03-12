import * as React from "react";
import { PanelContainer } from "@/plugins/sdk";
import { CoreCalcUtilityPanel as LegacyCalcUtilityPanel } from "@/plugins/sdk";

export type CalcUtilityPanelProps = React.ComponentProps<typeof LegacyCalcUtilityPanel>;

export function CalcUtilityPanel(props: CalcUtilityPanelProps) {
  return (
    <PanelContainer className="h-full">
      <LegacyCalcUtilityPanel {...props} />
    </PanelContainer>
  );
}
