import * as React from "react";
import { Music2 } from "lucide-react";
import { useHotkey } from "@tanstack/react-hotkeys";
import {
  List as PanelList,
  ListItem as PanelListItem,
  PanelContainer,
  PanelFlex,
  PanelText,
  createPluginBackendSdk,
  usePanelEnterBridge,
  usePanelFooter,
  usePanelFooterControlsRef,
} from "@/plugins/sdk";
import type { PanelFooterConfig } from "@/lib/panel-contract";
import { systemCommandScope } from "@/plugins/core/internal/system/system-command-scope";

type MediaControlPanelProps = {
  commandQuery: string;
  registerInputEnterHandler?: ((handler: (() => boolean | void) | null) => void) | undefined;
  registerPanelFooter?: ((footer: PanelFooterConfig | null) => void) | undefined;
  focusLauncherInput?: (() => void) | undefined;
};

type MediaAction = {
  id: "play-pause" | "next" | "previous";
  label: string;
};

const ACTIONS: MediaAction[] = [
  { id: "play-pause", label: "Play/Pause" },
  { id: "next", label: "Next Track" },
  { id: "previous", label: "Previous Track" },
];

export function MediaControlPanel({
  commandQuery,
  registerInputEnterHandler,
  registerPanelFooter,
}: MediaControlPanelProps) {
  const backend = React.useMemo(() => createPluginBackendSdk(systemCommandScope), []);
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [message, setMessage] = React.useState<string>("");
  const itemRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const { registerFooterControls } = usePanelFooterControlsRef();

  const selectedAction = ACTIONS[selectedIndex] ?? null;

  const runAction = React.useCallback(
    async (action: MediaAction) => {
      try {
        if (action.id === "play-pause") {
          await backend.system.mediaPlayPause();
        } else if (action.id === "next") {
          await backend.system.mediaNext();
        } else {
          await backend.system.mediaPrevious();
        }

        setMessage(`${action.label} sent.`);
      } catch (error) {
        console.error("[system-media] action failed", { action: action.id, error });
        setMessage("Media command failed.");
      }
    },
    [backend.system],
  );

  const runSelected = React.useCallback(async () => {
    if (!selectedAction) {
      return false;
    }
    await runAction(selectedAction);
    return true;
  }, [runAction, selectedAction]);

  React.useEffect(() => {
    itemRefs.current[selectedIndex]?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  React.useEffect(() => {
    const normalized = commandQuery.trim().toLowerCase();
    if (!normalized) {
      return;
    }

    if (["play", "pause", "toggle", "playpause"].includes(normalized)) {
      void runAction(ACTIONS[0]);
      return;
    }

    if (["next", "skip"].includes(normalized)) {
      void runAction(ACTIONS[1]);
      return;
    }

    if (["previous", "prev", "back"].includes(normalized)) {
      void runAction(ACTIONS[2]);
    }
  }, [commandQuery, runAction]);

  usePanelEnterBridge(
    registerInputEnterHandler,
    selectedAction
      ? () => {
          void runSelected();
          return true;
        }
      : null,
  );

  useHotkey(
    "ArrowDown",
    () => {
      setSelectedIndex((prev) => Math.min(ACTIONS.length - 1, prev + 1));
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

  const footerConfig = React.useMemo<PanelFooterConfig | null>(() => {
    if (!selectedAction) {
      return null;
    }

    return {
      panel: {
        title: "Media",
        icon: Music2,
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
  }, [registerFooterControls, runSelected, selectedAction]);

  usePanelFooter(registerPanelFooter, footerConfig);

  return (
    <PanelContainer padding="md" style={{ height: "100%" }}>
      <PanelFlex direction="col" gap="sm">
        <PanelText size="lg" weight="semibold">
          Media Controls
        </PanelText>
        <PanelText size="xs" tone="muted">
          Keyboard-first playback control.
        </PanelText>
      </PanelFlex>

      <PanelContainer style={{ marginTop: "0.75rem" }}>
        <PanelList gap="sm">
          {ACTIONS.map((action, index) => (
            <PanelListItem
              key={action.id}
              active={index === selectedIndex}
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              onMouseEnter={() => setSelectedIndex(index)}
              onClick={() => {
                setSelectedIndex(index);
                void runAction(action);
              }}
            >
              <PanelText>{action.label}</PanelText>
            </PanelListItem>
          ))}
        </PanelList>
      </PanelContainer>

      <PanelContainer style={{ marginTop: "0.75rem" }}>
        <PanelText size="xs" tone="muted">
          {message || "No command sent yet."}
        </PanelText>
      </PanelContainer>
    </PanelContainer>
  );
}
