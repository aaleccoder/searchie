import * as React from "react";
import { PanelContainer } from "@/plugins/sdk";
import { CoreConversionUtilityPanel as LegacyConversionUtilityPanel } from "@/plugins/sdk";

export type ConversionUtilityPanelProps = React.ComponentProps<typeof LegacyConversionUtilityPanel>;

export function ConversionUtilityPanel(props: ConversionUtilityPanelProps) {
  return (
    <PanelContainer className="h-full">
      <LegacyConversionUtilityPanel {...props} />
    </PanelContainer>
  );
}
