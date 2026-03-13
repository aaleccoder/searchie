import * as React from "react";
import type { PanelFooterConfig, PanelFooterControls } from "@/lib/panel-contract";

type ArrowDownHandler = (() => boolean | void) | null;
type EnterHandler = (() => boolean | void) | null;

type PanelFrameworkBridge = {
  registerInputArrowDownHandler?: ((handler: ArrowDownHandler) => void) | undefined;
  registerInputEnterHandler?: ((handler: EnterHandler) => void) | undefined;
  registerPanelFooter?: ((footer: PanelFooterConfig | null) => void) | undefined;
};

export function usePanelArrowDownBridge(
  registerHandler: PanelFrameworkBridge["registerInputArrowDownHandler"],
  handler: (() => boolean | void) | null,
) {
  React.useEffect(() => {
    if (!registerHandler) {
      return;
    }

    registerHandler(handler);
    return () => {
      registerHandler(null);
    };
  }, [handler, registerHandler]);
}

export function usePanelEnterBridge(
  registerHandler: PanelFrameworkBridge["registerInputEnterHandler"],
  handler: (() => boolean | void) | null,
) {
  React.useEffect(() => {
    if (!registerHandler) {
      return;
    }

    registerHandler(handler);
    return () => {
      registerHandler(null);
    };
  }, [handler, registerHandler]);
}

export function usePanelFooter(
  registerFooter: PanelFrameworkBridge["registerPanelFooter"],
  footerConfig: PanelFooterConfig | null,
) {
  React.useEffect(() => {
    registerFooter?.(footerConfig);
    return () => {
      registerFooter?.(null);
    };
  }, [footerConfig, registerFooter]);
}

export function usePanelFooterControlsRef() {
  const controlsRef = React.useRef<PanelFooterControls | null>(null);

  const registerFooterControls = React.useCallback((controls: PanelFooterControls | null) => {
    controlsRef.current = controls;
  }, []);

  return {
    controlsRef,
    registerFooterControls,
  };
}
