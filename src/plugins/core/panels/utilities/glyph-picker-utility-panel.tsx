import * as React from "react";
import { PanelContainer } from "@/plugins/sdk";
import { CoreGlyphPickerUtilityPanel as LegacyGlyphPickerUtilityPanel } from "@/plugins/sdk";

export type GlyphPickerUtilityPanelProps = React.ComponentProps<typeof LegacyGlyphPickerUtilityPanel>;

export function GlyphPickerUtilityPanel(props: GlyphPickerUtilityPanelProps) {
  return (
    <PanelContainer className="h-full">
      <LegacyGlyphPickerUtilityPanel {...props} />
    </PanelContainer>
  );
}
