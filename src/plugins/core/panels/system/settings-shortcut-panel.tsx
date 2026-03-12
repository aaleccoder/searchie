import * as React from "react";
import { PanelContainer } from "@/plugins/sdk";
import { CoreSettingsShortcutPanel as LegacySettingsShortcutPanel } from "@/plugins/sdk";

export type SettingsShortcutPanelProps = React.ComponentProps<typeof LegacySettingsShortcutPanel>;

export function SettingsShortcutPanel(props: SettingsShortcutPanelProps) {
  return (
    <PanelContainer className="h-full">
      <LegacySettingsShortcutPanel {...props} />
    </PanelContainer>
  );
}
