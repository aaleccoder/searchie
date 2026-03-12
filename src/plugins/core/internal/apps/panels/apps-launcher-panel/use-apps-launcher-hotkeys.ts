import * as React from "react";
import { useHotkey } from "@tanstack/react-hotkeys";
import { usePanelArrowDownBridge, usePanelEnterBridge } from "@/plugins/sdk";
import { isEditableElement } from "./helpers";
import type { AppActionItem, InstalledApp, NavigationItem, NavigationMode } from "./types";

type UseAppsLauncherHotkeysArgs = {
  registerInputArrowDownHandler?: ((handler: (() => boolean | void) | null) => void) | undefined;
  registerInputEnterHandler?: ((handler: (() => boolean | void) | null) => void) | undefined;
  focusLauncherInput?: (() => void) | undefined;
  selectedItem: NavigationItem | null;
  selectedApp: InstalledApp | null;
  appActions: AppActionItem[];
  selectedActionIndex: number;
  setSelectedActionIndex: React.Dispatch<React.SetStateAction<number>>;
  navigationMode: NavigationMode;
  setNavigationMode: (mode: NavigationMode) => void;
  selectedListIndex: number;
  navigationList: NavigationItem[];
  setSelectedId: (id: string) => void;
  useVirtualizedList: boolean;
  itemRefs: React.MutableRefObject<Map<string, HTMLButtonElement>>;
  footerControlsRef: React.RefObject<{
    openExtraActions: () => void;
    runExtraActionById: (id: string) => void;
  } | null>;
  footerExtraActionsCount: number;
  activateSelectedItem: () => boolean;
  selectFirstAppItem: () => boolean;
  focusListItemById: (id: string, preventScroll?: boolean) => void;
  focusActionByIndex: (index: number) => void;
  executeAppAction: (actionId: AppActionItem["id"], app: InstalledApp) => Promise<void>;
};

export function useAppsLauncherHotkeys({
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
  footerExtraActionsCount,
  activateSelectedItem,
  selectFirstAppItem,
  focusListItemById,
  focusActionByIndex,
  executeAppAction,
}: UseAppsLauncherHotkeysArgs) {
  const onInputArrowDown = React.useCallback(() => {
    if (!navigationList.length) {
      return false;
    }

    const first = navigationList[0];
    if (!first) {
      return false;
    }

    setSelectedId(first.id);
    setNavigationMode("list");
    const target = itemRefs.current.get(first.id);
    if (!target) {
      return false;
    }

    if (useVirtualizedList) {
      target.focus({ preventScroll: true });
    } else {
      target.focus();
    }

    return true;
  }, [itemRefs, navigationList, setNavigationMode, setSelectedId, useVirtualizedList]);

  usePanelArrowDownBridge(registerInputArrowDownHandler, onInputArrowDown);
  usePanelEnterBridge(registerInputEnterHandler, activateSelectedItem);

  useHotkey(
    "Alt+K",
    () => {
      footerControlsRef.current?.openExtraActions();
    },
    {
      enabled: !!selectedItem && footerExtraActionsCount > 0,
      preventDefault: true,
    },
  );

  useHotkey(
    "Alt+R",
    () => {
      if (selectedApp) {
        footerControlsRef.current?.runExtraActionById("run-as-admin");
      }
    },
    { enabled: !!selectedApp, preventDefault: true },
  );

  useHotkey(
    "Alt+U",
    () => {
      if (selectedApp) {
        footerControlsRef.current?.runExtraActionById("uninstall");
      }
    },
    { enabled: !!selectedApp, preventDefault: true },
  );

  useHotkey(
    "Alt+P",
    () => {
      if (selectedApp) {
        footerControlsRef.current?.runExtraActionById("properties");
      }
    },
    { enabled: !!selectedApp, preventDefault: true },
  );

  useHotkey(
    "Alt+L",
    () => {
      if (selectedApp) {
        footerControlsRef.current?.runExtraActionById("open-location");
      }
    },
    { enabled: !!selectedApp, preventDefault: true },
  );

  useHotkey(
    "ArrowDown",
    () => {
      if (!navigationList.length) {
        return;
      }

      if (navigationMode === "actions" && selectedApp && appActions.length > 0) {
        setSelectedActionIndex((prev) => {
          const next = Math.min(appActions.length - 1, prev + 1);
          focusActionByIndex(next);
          return next;
        });
        return;
      }

      const currentIndex = selectedListIndex >= 0 ? selectedListIndex : 0;
      const nextIndex = Math.min(navigationList.length - 1, currentIndex + 1);
      const nextItem = navigationList[nextIndex];
      if (!nextItem) {
        return;
      }

      setNavigationMode("list");
      setSelectedId(nextItem.id);
      focusListItemById(nextItem.id, useVirtualizedList);
    },
    { enabled: navigationList.length > 0, preventDefault: true },
  );

  useHotkey(
    "ArrowUp",
    () => {
      if (!navigationList.length) {
        return;
      }

      if (navigationMode === "actions" && selectedApp && appActions.length > 0) {
        setSelectedActionIndex((prev) => {
          const next = prev - 1;
          if (next >= 0) {
            focusActionByIndex(next);
            return next;
          }

          setNavigationMode("list");
          setSelectedId(selectedApp.id);
          focusListItemById(selectedApp.id, useVirtualizedList);
          return 0;
        });
        return;
      }

      const currentIndex = selectedListIndex >= 0 ? selectedListIndex : 0;
      const prevIndex = currentIndex - 1;
      if (prevIndex < 0) {
        focusLauncherInput?.();
        return;
      }

      const prevItem = navigationList[prevIndex];
      if (!prevItem) {
        return;
      }

      setNavigationMode("list");
      setSelectedId(prevItem.id);
      focusListItemById(prevItem.id, useVirtualizedList);
    },
    { enabled: navigationList.length > 0, preventDefault: true },
  );

  useHotkey(
    "ArrowRight",
    () => {
      if (!selectedApp || appActions.length === 0) {
        return;
      }

      setNavigationMode("actions");
      const nextIndex = Math.min(selectedActionIndex, appActions.length - 1);
      setSelectedActionIndex(nextIndex);
      focusActionByIndex(nextIndex);
    },
    { enabled: !!selectedApp && appActions.length > 0, preventDefault: true },
  );

  useHotkey(
    "ArrowLeft",
    () => {
      if (selectedItem?.kind === "panel-command" || selectedItem?.kind === "setting") {
        selectFirstAppItem();
        return;
      }

      if (navigationMode !== "actions" || !selectedApp) {
        return;
      }

      setNavigationMode("list");
      setSelectedId(selectedApp.id);
      focusListItemById(selectedApp.id, useVirtualizedList);
    },
    {
      enabled:
        (navigationMode === "actions" && !!selectedApp) ||
        selectedItem?.kind === "panel-command" ||
        selectedItem?.kind === "setting",
      preventDefault: true,
    },
  );

  useHotkey(
    "Escape",
    () => {
      const activeElement = document.activeElement;
      if (!isEditableElement(activeElement)) {
        focusLauncherInput?.();
      }
    },
    { enabled: !!focusLauncherInput },
  );

  useHotkey(
    "Enter",
    () => {
      if (navigationMode === "actions" && selectedApp) {
        const action = appActions[selectedActionIndex];
        if (action && !action.disabled) {
          void executeAppAction(action.id, selectedApp);
        }
        return;
      }

      activateSelectedItem();
    },
    { enabled: !!selectedItem, preventDefault: true },
  );
}
