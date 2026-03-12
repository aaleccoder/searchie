import * as React from "react";
import {
  PanelContainer,
  PanelList,
  PanelScrollArea,
} from "@/components/framework/panel-primitives";
import type { SettingsSearchEntry } from "@/plugins/core/internal/settings-search";
import { NavigationListItem } from "./navigation-list";
import type { InstalledApp, NavigationItem } from "./types";

type NavigationPaneProps = {
  listScrollHostRef: React.RefObject<HTMLDivElement | null>;
  useVirtualizedList: boolean;
  navigationList: NavigationItem[];
  selectedListIndex: number;
  selectedItemId?: string;
  iconCacheVersion: number;
  itemRefs: React.MutableRefObject<Map<string, HTMLButtonElement>>;
  clearLauncherInput?: (() => void) | undefined;
  activatePanelSession?: ((panel: import("@/lib/panel-contract").ShortcutPanelDescriptor, nextQuery: string) => void) | undefined;
  setNavigationMode: (mode: "list" | "actions") => void;
  setSelectedId: (id: string) => void;
  executeSettingOpen: (setting: SettingsSearchEntry, uri?: string) => Promise<void>;
  executeAppOpen: (app: InstalledApp) => void;
  getListScrollViewport: () => HTMLElement | null;
};

export function NavigationPane({
  listScrollHostRef,
  useVirtualizedList,
  navigationList,
  selectedListIndex,
  selectedItemId,
  iconCacheVersion,
  itemRefs,
  clearLauncherInput,
  activatePanelSession,
  setNavigationMode,
  setSelectedId,
  executeSettingOpen,
  executeAppOpen,
  getListScrollViewport,
}: NavigationPaneProps) {
  return (
    <PanelContainer ref={listScrollHostRef} style={{ overflow: "hidden", height: "100%" }}>
      <PanelScrollArea style={{ height: "100%" }}>
        <PanelList
          gap="xs"
          virtualize={
            useVirtualizedList
              ? {
                  count: navigationList.length,
                  estimateSize: 42,
                  overscan: 10,
                  scrollToIndex: selectedListIndex >= 0 ? selectedListIndex : undefined,
                  getScrollElement: getListScrollViewport,
                  getItemKey: (index) => navigationList[index]?.id ?? `nav-item-${index}`,
                  renderItem: (index) => {
                    const item = navigationList[index];
                    if (!item) {
                      return null;
                    }
                    return (
                      <NavigationListItem
                        item={item}
                        selectedItemId={selectedItemId}
                        iconCacheVersion={iconCacheVersion}
                        itemRefs={itemRefs}
                        clearLauncherInput={clearLauncherInput}
                        executeSettingOpen={executeSettingOpen}
                        executeAppOpen={executeAppOpen}
                        activatePanelSession={activatePanelSession}
                        setNavigationMode={setNavigationMode}
                        setSelectedId={setSelectedId}
                      />
                    );
                  },
                }
              : undefined
          }
        >
          {!useVirtualizedList
            ? navigationList.map((item) => (
                <NavigationListItem
                  key={item.id}
                  item={item}
                  selectedItemId={selectedItemId}
                  iconCacheVersion={iconCacheVersion}
                  itemRefs={itemRefs}
                  clearLauncherInput={clearLauncherInput}
                  executeSettingOpen={executeSettingOpen}
                  executeAppOpen={executeAppOpen}
                  activatePanelSession={activatePanelSession}
                  setNavigationMode={setNavigationMode}
                  setSelectedId={setSelectedId}
                />
              ))
            : null}
        </PanelList>
      </PanelScrollArea>
    </PanelContainer>
  );
}
