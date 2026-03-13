import * as React from "react";
import { RadioTower } from "lucide-react";
import { useHotkey } from "@tanstack/react-hotkeys";
import {
  List as PanelList,
  ListItem as PanelListItem,
  PanelContainer,
  PanelFlex,
  ScrollArea as PanelScrollArea,
  PanelText,
  createPluginBackendSdk,
  usePanelEnterBridge,
  usePanelFooter,
  usePanelFooterControlsRef,
} from "@/plugins/sdk";
import type { PanelFooterConfig } from "@/lib/panel-contract";
import { parseConnectivityCommand, type ConnectivityTarget } from "@/lib/utilities/system-control-engine";
import { systemCommandScope } from "@/plugins/core/internal/system/system-command-scope";

type ConnectivityControlPanelProps = {
  title: string;
  target: ConnectivityTarget;
  settingsUri: string;
  commandQuery: string;
  registerInputEnterHandler?: ((handler: (() => boolean | void) | null) => void) | undefined;
  registerPanelFooter?: ((footer: PanelFooterConfig | null) => void) | undefined;
  focusLauncherInput?: (() => void) | undefined;
};

type ActionRow = {
  id: string;
  label: string;
  run: () => Promise<void>;
};

export function ConnectivityControlPanel({
  title,
  target,
  settingsUri,
  commandQuery,
  registerInputEnterHandler,
  registerPanelFooter,
}: ConnectivityControlPanelProps) {
  const backend = React.useMemo(() => createPluginBackendSdk(systemCommandScope), []);
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [lastMessage, setLastMessage] = React.useState<string>("");
  const lastAppliedQueryRef = React.useRef<string>("");
  const itemRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const { registerFooterControls } = usePanelFooterControlsRef();

  const runSet = React.useCallback(
    async (enabled: boolean) => {
      if (target === "wifi") {
        await backend.system.setWifiEnabled(enabled);
      } else if (target === "bluetooth") {
        await backend.system.setBluetoothEnabled(enabled);
      } else if (target === "airplane") {
        await backend.system.setAirplaneMode(enabled);
      } else {
        await backend.system.setHotspotEnabled(enabled);
      }
      setLastMessage(`${title} ${enabled ? "enabled" : "disabled"}.`);
    },
    [backend.system, target, title],
  );

  const runToggle = React.useCallback(async () => {
    if (target === "wifi") {
      await backend.system.toggleWifi();
    } else if (target === "bluetooth") {
      await backend.system.toggleBluetooth();
    } else if (target === "airplane") {
      await backend.system.toggleAirplaneMode();
    } else {
      await backend.system.toggleHotspot();
    }
    setLastMessage(`${title} toggled.`);
  }, [backend.system, target, title]);

  const actions = React.useMemo<ActionRow[]>(
    () => [
      { id: "on", label: "Turn On", run: () => runSet(true) },
      { id: "off", label: "Turn Off", run: () => runSet(false) },
      { id: "toggle", label: "Toggle", run: runToggle },
      {
        id: "settings",
        label: "Open Settings",
        run: async () => {
          await backend.system.openSettingsUri(settingsUri);
          setLastMessage("Opened system settings.");
        },
      },
    ],
    [backend.system, runSet, runToggle, settingsUri],
  );

  const selectedAction = actions[selectedIndex] ?? null;

  const runSelected = React.useCallback(async () => {
    if (!selectedAction) {
      return false;
    }

    try {
      await selectedAction.run();
    } catch (error) {
      console.error("[system-connectivity] action failed", { target, action: selectedAction.id, error });
      setLastMessage("Action failed. Check system permissions.");
    }

    return true;
  }, [selectedAction, target]);

  React.useEffect(() => {
    itemRefs.current[selectedIndex]?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  React.useEffect(() => {
    const normalizedQuery = commandQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      lastAppliedQueryRef.current = "";
      return;
    }

    if (normalizedQuery === lastAppliedQueryRef.current) {
      return;
    }

    const parsed = parseConnectivityCommand(target, normalizedQuery);
    if (!parsed) {
      return;
    }

    lastAppliedQueryRef.current = normalizedQuery;

    void (async () => {
      try {
        if (parsed.action === "toggle") {
          await runToggle();
        } else {
          await runSet(parsed.value);
        }
      } catch (error) {
        console.error("[system-connectivity] command query action failed", { target, commandQuery, error });
      }
    })();
  }, [commandQuery, runSet, runToggle, target]);

  useHotkey(
    "ArrowDown",
    () => {
      setSelectedIndex((prev) => Math.min(actions.length - 1, prev + 1));
    },
    { preventDefault: true },
  );

  useHotkey(
    "ArrowUp",
    () => {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    },
    { preventDefault: true },
  );

  usePanelEnterBridge(
    registerInputEnterHandler,
    selectedAction
      ? () => {
          void runSelected();
          return true;
        }
      : null,
  );

  const footerConfig = React.useMemo<PanelFooterConfig | null>(() => {
    if (!selectedAction) {
      return null;
    }

    return {
      panel: {
        title,
        icon: RadioTower,
      },
      registerControls: registerFooterControls,
      primaryAction: {
        id: selectedAction.id,
        label: selectedAction.label,
        onSelect: () => {
          void runSelected();
        },
        shortcutHint: "Enter",
      },
    };
  }, [registerFooterControls, runSelected, selectedAction, title]);

  usePanelFooter(registerPanelFooter, footerConfig);

  return (
    <PanelContainer padding="md" style={{ height: "100%" }}>
      <PanelFlex direction="col" gap="sm" style={{ height: "100%" }}>
        <PanelFlex direction="col" gap="sm">
          <PanelText size="lg" weight="semibold">
            {title}
          </PanelText>
          <PanelText size="xs" tone="muted">
            Use Enter to run selected action.
          </PanelText>
        </PanelFlex>

        <PanelScrollArea style={{ flex: 1 }}>
          <PanelList gap="sm">
            {actions.map((action, index) => (
            <PanelListItem
              key={action.id}
              active={index === selectedIndex}
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              onMouseEnter={() => setSelectedIndex(index)}
              onClick={() => {
                setSelectedIndex(index);
                action.run().catch((error) => {
                  console.error("[system-connectivity] click action failed", { target, action: action.id, error });
                  setLastMessage("Action failed. Check system permissions.");
                });
              }}
            >
              <PanelText truncate>{action.label}</PanelText>
            </PanelListItem>
            ))}
          </PanelList>
        </PanelScrollArea>

        <PanelText size="xs" tone="muted">
          {lastMessage || "No action executed yet."}
        </PanelText>
      </PanelFlex>
    </PanelContainer>
  );
}
