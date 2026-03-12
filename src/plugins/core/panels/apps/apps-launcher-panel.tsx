import * as React from "react";
import { PanelContainer } from "@/plugins/sdk";
import { CoreAppsLauncherPanel as LegacyAppsLauncherPanel } from "@/plugins/sdk";

export type AppsLauncherPanelProps = React.ComponentProps<typeof LegacyAppsLauncherPanel>;

export function AppsLauncherPanel(props: AppsLauncherPanelProps) {
  return (
    <PanelContainer className="h-full">
      <LegacyAppsLauncherPanel {...props} />
    </PanelContainer>
  );
}
