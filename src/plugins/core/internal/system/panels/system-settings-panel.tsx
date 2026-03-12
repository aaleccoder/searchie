import * as React from "react";
import { Settings2, Wifi, Bluetooth, Plane, Radio, Gauge, Volume2, MonitorUp } from "lucide-react";
import { useHotkey } from "@tanstack/react-hotkeys";
import {
  Grid as PanelGrid,
  List as PanelList,
  ListItem as PanelListItem,
  MetaGrid as PanelMetaGrid,
  PanelAside,
  PanelContainer,
  PanelFlex,
  PanelSection,
  PanelText,
  ScrollArea as PanelScrollArea,
  createPluginBackendSdk,
  usePanelEnterBridge,
  usePanelFooter,
  usePanelFooterControlsRef,
} from "@/plugins/sdk";
import type { PanelFooterConfig } from "@/lib/panel-contract";
import { systemCommandScope } from "@/plugins/core/internal/system/system-command-scope";

type SettingsShortcut = {
  id: string;
  label: string;
  uri: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
};

type SystemSettingsPanelProps = {
  commandQuery: string;
  registerInputEnterHandler?: ((handler: (() => boolean | void) | null) => void) | undefined;
  registerPanelFooter?: ((footer: PanelFooterConfig | null) => void) | undefined;
};

const SETTINGS_SHORTCUTS: SettingsShortcut[] = [
  {
    id: "sound",
    label: "Sound Settings",
    uri: "ms-settings:sound",
    description: "Open device volume and output options",
    icon: Volume2,
  },
  {
    id: "display",
    label: "Display Brightness",
    uri: "ms-settings:display",
    description: "Open display and brightness options",
    icon: MonitorUp,
  },
  {
    id: "wifi",
    label: "Wi-Fi Settings",
    uri: "ms-settings:network-wifi",
    description: "Open wireless network controls",
    icon: Wifi,
  },
  {
    id: "bluetooth",
    label: "Bluetooth Settings",
    uri: "ms-settings:bluetooth",
    description: "Open Bluetooth devices and pairing",
    icon: Bluetooth,
  },
  {
    id: "airplane",
    label: "Airplane Mode",
    uri: "ms-settings:network-airplanemode",
    description: "Open airplane mode controls",
    icon: Plane,
  },
  {
    id: "hotspot",
    label: "Mobile Hotspot",
    uri: "ms-settings:network-mobilehotspot",
    description: "Open mobile hotspot sharing settings",
    icon: Radio,
  },
  {
    id: "power",
    label: "Power And Battery",
    uri: "ms-settings:powersleep",
    description: "Open energy profile and battery controls",
    icon: Gauge,
  },
];

export function SystemSettingsPanel({
  commandQuery,
  registerInputEnterHandler,
  registerPanelFooter,
}: SystemSettingsPanelProps) {
  const backend = React.useMemo(() => createPluginBackendSdk(systemCommandScope), []);
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const itemRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const { registerFooterControls } = usePanelFooterControlsRef();

  const filtered = React.useMemo(() => {
    const query = commandQuery.trim().toLowerCase();
    if (!query) {
      return SETTINGS_SHORTCUTS;
    }

    return SETTINGS_SHORTCUTS.filter((entry) => {
      return (
        entry.label.toLowerCase().includes(query) ||
        entry.description.toLowerCase().includes(query) ||
        entry.uri.toLowerCase().includes(query)
      );
    });
  }, [commandQuery]);

  React.useEffect(() => {
    setSelectedIndex((prev) => {
      if (filtered.length === 0) {
        return 0;
      }
      return Math.min(prev, filtered.length - 1);
    });
  }, [filtered]);

  React.useEffect(() => {
    itemRefs.current[selectedIndex]?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const selected = filtered[selectedIndex] ?? null;

  const openSelected = React.useCallback(async () => {
    if (!selected) {
      return false;
    }

    try {
      await backend.system.openSettingsUri(selected.uri);
    } catch (error) {
      console.error("[system-settings] failed to open shortcut", {
        uri: selected.uri,
        error,
      });
    }

    return true;
  }, [backend.system, selected]);

  usePanelEnterBridge(
    registerInputEnterHandler,
    selected
      ? () => {
          void openSelected();
          return true;
        }
      : null,
  );

  useHotkey(
    "ArrowDown",
    () => {
      setSelectedIndex((prev) => Math.min(filtered.length - 1, prev + 1));
    },
    { enabled: filtered.length > 0, preventDefault: true },
  );

  useHotkey(
    "ArrowUp",
    () => {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    },
    { enabled: filtered.length > 0, preventDefault: true },
  );

  const footerConfig = React.useMemo<PanelFooterConfig | null>(() => {
    if (!selected) {
      return null;
    }

    return {
      panel: {
        title: "System Settings",
        icon: Settings2,
      },
      registerControls: registerFooterControls,
      primaryAction: {
        id: "open",
        label: "Open Setting",
        onSelect: () => {
          void openSelected();
        },
        shortcutHint: "Enter",
      },
    };
  }, [openSelected, registerFooterControls, selected]);

  usePanelFooter(registerPanelFooter, footerConfig);

  return (
    <PanelGrid columns="two-pane" gap="sm" style={{ height: "100%" }}>
      <PanelSection style={{ height: "100%", overflow: "hidden" }}>
        <PanelScrollArea style={{ height: "100%" }}>
          <PanelContainer padding="md">
            <PanelList gap="sm">
              {filtered.map((entry, index) => {
                const Icon = entry.icon;
                return (
                  <PanelListItem
                    key={entry.id}
                    active={index === selectedIndex}
                    ref={(el) => {
                      itemRefs.current[index] = el;
                    }}
                    onMouseEnter={() => setSelectedIndex(index)}
                    onClick={() => {
                      setSelectedIndex(index);
                      void backend.system.openSettingsUri(entry.uri);
                    }}
                  >
                    <PanelFlex align="center" gap="sm" style={{ width: "100%" }}>
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <PanelFlex direction="col" gap="xs" style={{ minWidth: 0 }}>
                        <PanelText truncate>{entry.label}</PanelText>
                        <PanelText size="xs" tone="muted" truncate>
                          {entry.description}
                        </PanelText>
                      </PanelFlex>
                    </PanelFlex>
                  </PanelListItem>
                );
              })}
            </PanelList>
          </PanelContainer>
        </PanelScrollArea>
      </PanelSection>

      <PanelAside>
        <PanelContainer padding="md">
          {!selected && (
            <PanelText size="sm" tone="muted">
              No matching settings shortcut.
            </PanelText>
          )}

          {selected && (
            <PanelFlex direction="col" gap="md">
              <PanelText size="lg" weight="semibold">
                {selected.label}
              </PanelText>
              <PanelText size="sm" tone="muted">
                {selected.description}
              </PanelText>
              <PanelMetaGrid>
                <PanelText size="xs" tone="muted">
                  URI
                </PanelText>
                <PanelText size="xs" mono truncate style={{ textAlign: "right" }} title={selected.uri}>
                  {selected.uri}
                </PanelText>
              </PanelMetaGrid>
              <PanelText size="xs" tone="muted" mono>
                Enter to open
              </PanelText>
            </PanelFlex>
          )}
        </PanelContainer>
      </PanelAside>
    </PanelGrid>
  );
}
