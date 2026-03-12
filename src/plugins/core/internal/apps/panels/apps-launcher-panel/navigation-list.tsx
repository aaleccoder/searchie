import * as React from "react";
import { Rocket, Settings2 } from "lucide-react";
import {
  PanelContainer,
  PanelFlex,
  PanelInline,
  PanelListItem,
} from "@/components/framework/panel-primitives";
import type { ShortcutPanelDescriptor } from "@/lib/panel-contract";
import type { SettingsSearchEntry } from "@/plugins/core/internal/settings-search";
import type { InstalledApp, NavigationItem } from "./types";
import { AppIcon, SingleLineTooltipText } from "./ui";

type NavigationListItemProps = {
  item: NavigationItem;
  selectedItemId?: string;
  iconCacheVersion: number;
  itemRefs: React.MutableRefObject<Map<string, HTMLButtonElement>>;
  clearLauncherInput?: (() => void) | undefined;
  executeSettingOpen: (setting: SettingsSearchEntry, uri?: string) => Promise<void>;
  executeAppOpen: (app: InstalledApp) => void;
  activatePanelSession?: ((panel: ShortcutPanelDescriptor, nextQuery: string) => void) | undefined;
  setNavigationMode: (mode: "list" | "actions") => void;
  setSelectedId: (id: string) => void;
};

export function NavigationListItem({
  item,
  selectedItemId,
  iconCacheVersion,
  itemRefs,
  clearLauncherInput,
  executeSettingOpen,
  executeAppOpen,
  activatePanelSession,
  setNavigationMode,
  setSelectedId,
}: NavigationListItemProps) {
  const active = selectedItemId === item.id;

  const registerRef = (el: HTMLButtonElement | null) => {
    if (el) {
      itemRefs.current.set(item.id, el);
    } else {
      itemRefs.current.delete(item.id);
    }
  };

  const selectCurrent = () => {
    setNavigationMode("list");
    setSelectedId(item.id);
  };

  if (item.kind === "panel-command") {
    const CommandIcon = item.command.panel.commandIcon ?? Rocket;
    return (
      <PanelListItem
        type="button"
        active={active}
        ref={registerRef}
        onMouseEnter={selectCurrent}
        onFocus={selectCurrent}
        onClick={() => {
          selectCurrent();
          clearLauncherInput?.();
          activatePanelSession?.(item.command.panel, item.command.commandQuery);
        }}
      >
        <PanelFlex align="center" justify="between" style={{ width: "100%" }}>
          <PanelFlex align="center" gap="sm">
            <PanelContainer
              surface="muted"
              radius="sm"
              style={{ width: 24, height: 24, display: "grid", placeItems: "center", flexShrink: 0 }}
            >
              <CommandIcon size={14} />
            </PanelContainer>
            <SingleLineTooltipText text={`Open ${item.command.label}`} size="sm" />
          </PanelFlex>
          <PanelInline size="xs" tone="muted" mono>Command</PanelInline>
        </PanelFlex>
      </PanelListItem>
    );
  }

  if (item.kind === "setting") {
    const setting = item.setting;
    return (
      <PanelListItem
        type="button"
        active={active}
        ref={registerRef}
        onMouseEnter={selectCurrent}
        onFocus={selectCurrent}
        onClick={() => {
          selectCurrent();
          void executeSettingOpen(setting);
        }}
      >
        <PanelFlex align="center" justify="between" style={{ width: "100%" }}>
          <PanelFlex align="center" gap="sm">
            <PanelContainer
              surface="muted"
              radius="sm"
              style={{ width: 24, height: 24, display: "grid", placeItems: "center", flexShrink: 0 }}
            >
              <Settings2 size={14} />
            </PanelContainer>
            <PanelFlex direction="col" gap="xs">
              <SingleLineTooltipText text={`Open Setting ${setting.settingsPage}`} size="sm" />
              <SingleLineTooltipText text={setting.uris[0] ?? "ms-settings:"} size="xs" tone="muted" />
            </PanelFlex>
          </PanelFlex>
          <PanelInline size="xs" tone="muted" mono>Setting</PanelInline>
        </PanelFlex>
      </PanelListItem>
    );
  }

  const app = item.app;
  return (
    <PanelListItem
      type="button"
      active={active}
      ref={registerRef}
      onMouseEnter={selectCurrent}
      onFocus={selectCurrent}
      onClick={() => {
        selectCurrent();
        executeAppOpen(app);
      }}
    >
      <AppIcon appId={app.id} cacheVersion={iconCacheVersion} />
      <SingleLineTooltipText text={app.name} size="sm" />
    </PanelListItem>
  );
}
