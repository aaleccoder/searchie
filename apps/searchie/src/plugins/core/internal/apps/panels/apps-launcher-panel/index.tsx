import * as React from "react";
import { PanelGrid, PanelTooltipProvider } from "@/components/framework/panel-primitives";
import { usePanelFooter, usePanelFooterControlsRef } from "@/plugins/sdk";
import { buildFooterConfig } from "./footer-config";
import { NavigationPane } from "./navigation-pane";
import { RightPane } from "./right-pane";
import { useAppsLauncherData } from "./use-apps-launcher-data";
import { useAppsLauncherHotkeys } from "./use-apps-launcher-hotkeys";
import type { AppsLauncherPanelProps } from "./types";

export function AppsLauncherPanel({
  commandQuery,
  registerInputArrowDownHandler,
  registerInputEnterHandler,
  registerPanelFooter,
  focusLauncherInput,
  clearLauncherInput,
  closeLauncherWindow,
  activatePanelSession,
}: AppsLauncherPanelProps) {
  const { controlsRef: footerControlsRef, registerFooterControls } = usePanelFooterControlsRef();
  const {
    itemRefs,
    listScrollHostRef,
    getListScrollViewport,
    selectedItem,
    selectedApp,
    selectedListIndex,
    selectedActionIndex,
    setSelectedActionIndex,
    navigationMode,
    setNavigationMode,
    navigationList,
    setSelectedId,
    iconCacheVersion,
    useVirtualizedList,
    appActions,
    busy,
    busyActionId,
    executeAppAction,
    executeDirectCommand,
    focusListItemById,
    focusActionByIndex,
    selectFirstAppItem,
  } = useAppsLauncherData({
    commandQuery,
    clearLauncherInput,
    closeLauncherWindow,
  });

  const activateSelectedItem = React.useCallback(() => {
    if (!selectedItem) {
      return false;
    }

    if (selectedItem.kind === "panel-command") {
      clearLauncherInput?.();
      activatePanelSession?.(selectedItem.command.panel, selectedItem.command.commandQuery);
      return true;
    }

    if (selectedItem.kind === "direct-command") {
      void executeDirectCommand(selectedItem);
      return true;
    }

    void executeAppAction("open", selectedItem.app);
    return true;
  }, [activatePanelSession, clearLauncherInput, executeAppAction, executeDirectCommand, selectedItem]);

  const footerConfig = React.useMemo(
    () =>
      buildFooterConfig({
        selectedItem,
        appActions,
        busy,
        busyActionId,
        registerFooterControls,
        clearLauncherInput,
        activatePanelSession,
        executeAppAction,
      }),
    [
      selectedItem,
      appActions,
      busy,
      busyActionId,
      registerFooterControls,
      clearLauncherInput,
      activatePanelSession,
      executeAppAction,
    ],
  );

  usePanelFooter(registerPanelFooter, footerConfig);

  useAppsLauncherHotkeys({
    registerInputArrowDownHandler,
    registerInputEnterHandler,
    focusLauncherInput,
    selectedItem,
    selectedApp,
    appActions,
    selectedActionIndex,
    setSelectedActionIndex,
    navigationMode,
    setNavigationMode,
    selectedListIndex,
    navigationList,
    setSelectedId,
    useVirtualizedList,
    itemRefs,
    footerControlsRef,
    footerExtraActionsCount: footerConfig?.extraActions?.length ?? 0,
    activateSelectedItem,
    selectFirstAppItem,
    focusListItemById,
    focusActionByIndex,
    executeAppAction,
  });

  return (
    <PanelTooltipProvider>
      <PanelGrid columns="two-pane" gap="sm" style={{ height: "100%" }}>
        <NavigationPane
          listScrollHostRef={listScrollHostRef}
          useVirtualizedList={useVirtualizedList}
          navigationList={navigationList}
          selectedListIndex={selectedListIndex}
          selectedItemId={selectedItem?.id}
          iconCacheVersion={iconCacheVersion}
          itemRefs={itemRefs}
          clearLauncherInput={clearLauncherInput}
          activatePanelSession={activatePanelSession}
          setNavigationMode={setNavigationMode}
          setSelectedId={setSelectedId}
          executeAppOpen={(app) => {
            void executeAppAction("open", app);
          }}
          executeDirectCommand={(command) => {
            void executeDirectCommand(command);
          }}
          getListScrollViewport={getListScrollViewport}
        />

        <RightPane selectedItem={selectedItem} selectFirstAppItem={selectFirstAppItem} />
      </PanelGrid>
    </PanelTooltipProvider>
  );
}
