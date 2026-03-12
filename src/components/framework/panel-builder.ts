import * as React from "react";
import type { PanelRenderProps, ShortcutPanelDescriptor } from "@/lib/panel-contract";

const PANEL_COMPONENT_MARK = "searchie.panel.framework.v1";

type PanelFrameworkComponent = React.ComponentType<PanelRenderProps> & {
  [PANEL_COMPONENT_MARK]: true;
};

export function createPanelComponent(
  component: React.ComponentType<PanelRenderProps>,
): PanelFrameworkComponent {
  const branded = component as PanelFrameworkComponent;
  branded[PANEL_COMPONENT_MARK] = true;
  return branded;
}

export function isPanelFrameworkComponent(component: unknown): component is PanelFrameworkComponent {
  if (!component || (typeof component !== "function" && typeof component !== "object")) {
    return false;
  }

  return Boolean((component as Record<string, unknown>)[PANEL_COMPONENT_MARK]);
}

export function definePanel(descriptor: ShortcutPanelDescriptor): ShortcutPanelDescriptor {
  return {
    ...descriptor,
    component: createPanelComponent(descriptor.component),
  };
}
