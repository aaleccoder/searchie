import * as React from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SettingsPanel } from "@/components/settings-panel";

type SettingsShortcutPanelProps = {
  commandQuery: string;
};

export function SettingsShortcutPanel(_props: SettingsShortcutPanelProps) {
  return (
    <div className="h-full overflow-hidden">
      <ScrollArea className="h-full">
        <div className="p-2">
          <SettingsPanel className="max-w-none" />
        </div>
      </ScrollArea>
    </div>
  );
}
