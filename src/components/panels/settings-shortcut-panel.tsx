import { PanelScrollArea } from "@/components/panels/framework";
import { SettingsPanel } from "@/components/settings-panel";

type SettingsShortcutPanelProps = {
  commandQuery: string;
};

export function SettingsShortcutPanel(_props: SettingsShortcutPanelProps) {
  return (
    <div className="h-full overflow-hidden">
      <PanelScrollArea className="h-full">
        <div className="p-2">
          <SettingsPanel className="max-w-none" />
        </div>
      </PanelScrollArea>
    </div>
  );
}
