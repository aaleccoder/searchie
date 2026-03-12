import { PanelContainer, ScrollArea as PanelScrollArea } from "@/plugins/sdk";
import { SettingsPanel } from "@/components/settings-panel";

type SettingsShortcutPanelProps = {
  commandQuery: string;
};

export function SettingsShortcutPanel(_props: SettingsShortcutPanelProps) {
  return (
    <PanelContainer className="h-full overflow-hidden">
      <PanelScrollArea className="h-full">
        <PanelContainer className="p-2">
          <SettingsPanel className="max-w-none" />
        </PanelContainer>
      </PanelScrollArea>
    </PanelContainer>
  );
}
