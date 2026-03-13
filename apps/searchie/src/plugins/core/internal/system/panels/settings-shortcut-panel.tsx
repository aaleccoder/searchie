import { PanelContainer, ScrollArea as PanelScrollArea } from "@/plugins/sdk";
import { SettingsPanel } from "@/components/settings/settings-panel";

type SettingsShortcutPanelProps = {
  commandQuery: string;
};

export function SettingsShortcutPanel(_props: SettingsShortcutPanelProps) {
  return (
    <PanelContainer style={{ height: "100%", overflow: "hidden" }}>
      <PanelScrollArea style={{ height: "100%" }}>
        <PanelContainer padding="sm">
          <SettingsPanel />
        </PanelContainer>
      </PanelScrollArea>
    </PanelContainer>
  );
}
