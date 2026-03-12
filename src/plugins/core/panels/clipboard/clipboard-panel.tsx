import * as React from "react";
import { PanelContainer } from "@/plugins/sdk";
import { CoreClipboardPanel as LegacyClipboardPanel } from "@/plugins/sdk";

export type ClipboardPanelProps = React.ComponentProps<typeof LegacyClipboardPanel>;

export function ClipboardPanel(props: ClipboardPanelProps) {
  return (
    <PanelContainer className="h-full">
      <LegacyClipboardPanel {...props} />
    </PanelContainer>
  );
}
