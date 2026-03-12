import * as React from "react";
import { PanelContainer } from "@/plugins/sdk";
import { CoreHotkeysShortcutPanel as LegacyHotkeysShortcutPanel } from "@/plugins/sdk";

export type HotkeysShortcutPanelProps = React.ComponentProps<typeof LegacyHotkeysShortcutPanel>;

export function HotkeysShortcutPanel(props: HotkeysShortcutPanelProps) {
  return (
    <PanelContainer className="h-full">
      <LegacyHotkeysShortcutPanel {...props} />
    </PanelContainer>
  );
}
