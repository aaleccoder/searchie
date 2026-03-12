import * as React from "react";
import { PanelContainer } from "@/plugins/sdk";
import { CoreFileSearchUtilityPanel as LegacyFileSearchUtilityPanel } from "@/plugins/sdk";

export type FileSearchUtilityPanelProps = React.ComponentProps<typeof LegacyFileSearchUtilityPanel>;

export function FileSearchUtilityPanel(props: FileSearchUtilityPanelProps) {
  return (
    <PanelContainer className="h-full">
      <LegacyFileSearchUtilityPanel {...props} />
    </PanelContainer>
  );
}
