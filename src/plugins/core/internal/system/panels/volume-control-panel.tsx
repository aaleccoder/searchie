import * as React from "react";
import { Volume2 } from "lucide-react";
import { useHotkey } from "@tanstack/react-hotkeys";
import {
  PanelContainer,
  PanelFlex,
  Slider as PanelSlider,
  PanelText,
  createPluginBackendSdk,
  usePanelEnterBridge,
  usePanelFooter,
  usePanelFooterControlsRef,
} from "@/plugins/sdk";
import type { PanelFooterConfig } from "@/lib/panel-contract";
import { parseVolumeCommand } from "@/lib/utilities/system-control-engine";
import { systemCommandScope } from "@/plugins/core/internal/system/system-command-scope";

type VolumeControlPanelProps = {
  commandQuery: string;
  registerInputEnterHandler?: ((handler: (() => boolean | void) | null) => void) | undefined;
  registerPanelFooter?: ((footer: PanelFooterConfig | null) => void) | undefined;
  focusLauncherInput?: (() => void) | undefined;
};

function getSliderValue(value: number | readonly number[]): number {
  if (typeof value === "number") {
    return value;
  }

  if (Array.isArray(value) && typeof value[0] === "number") {
    return value[0];
  }

  return 0;
}

export function VolumeControlPanel({
  commandQuery,
  registerInputEnterHandler,
  registerPanelFooter,
}: VolumeControlPanelProps) {
  const backend = React.useMemo(() => createPluginBackendSdk(systemCommandScope), []);
  const [volume, setVolume] = React.useState<number>(40);
  const [message, setMessage] = React.useState<string>("");
  const lastAppliedQueryRef = React.useRef<string>("");
  const { registerFooterControls } = usePanelFooterControlsRef();

  const setExactVolume = React.useCallback(
    async (nextValue: number) => {
      try {
        await backend.system.setVolume(nextValue);
        setVolume(nextValue);
        setMessage(`Volume set to ${nextValue}%.`);
      } catch (error) {
        console.error("[system-volume] set failed", { value: nextValue, error });
        setMessage("Volume command failed.");
      }
    },
    [backend.system],
  );

  const applyCommandFromQuery = React.useCallback(async () => {
    const parsed = parseVolumeCommand(commandQuery);
    if (!parsed) {
      return false;
    }

    try {
      if (parsed.kind === "set") {
        await setExactVolume(parsed.value);
        return true;
      }

      if (parsed.kind === "step") {
        const next = Math.max(0, Math.min(100, volume + parsed.delta));
        await backend.system.changeVolume(parsed.delta);
        setVolume(next);
        setMessage(`Volume ${parsed.delta > 0 ? "increased" : "decreased"} to ${next}%.`);
        return true;
      }

      if (parsed.kind === "toggle-mute") {
        await backend.system.toggleMute();
        setMessage("Mute toggled.");
        return true;
      }

      await backend.system.setMute(parsed.value);
      setMessage(parsed.value ? "Muted." : "Unmuted.");
      return true;
    } catch (error) {
      console.error("[system-volume] command failed", { commandQuery, error });
      setMessage("Volume command failed.");
      return false;
    }
  }, [backend.system, commandQuery, setExactVolume, volume]);

  usePanelEnterBridge(
    registerInputEnterHandler,
    () => {
      void applyCommandFromQuery();
      return true;
    },
  );

  React.useEffect(() => {
    const normalizedQuery = commandQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      lastAppliedQueryRef.current = "";
      return;
    }

    if (normalizedQuery === lastAppliedQueryRef.current) {
      return;
    }

    const parsed = parseVolumeCommand(normalizedQuery);
    if (!parsed) {
      return;
    }

    lastAppliedQueryRef.current = normalizedQuery;
    void applyCommandFromQuery();
  }, [applyCommandFromQuery, commandQuery]);

  useHotkey(
    "ArrowRight",
    () => {
      void backend.system.changeVolume(5);
      setVolume((prev) => Math.min(100, prev + 5));
    },
    { preventDefault: true },
  );

  useHotkey(
    "ArrowLeft",
    () => {
      void backend.system.changeVolume(-5);
      setVolume((prev) => Math.max(0, prev - 5));
    },
    { preventDefault: true },
  );

  useHotkey(
    "M",
    () => {
      void backend.system.toggleMute();
      setMessage("Mute toggled.");
    },
    { preventDefault: true },
  );

  const footerConfig = React.useMemo<PanelFooterConfig>(() => {
    return {
      panel: {
        title: "Volume",
        icon: Volume2,
      },
      registerControls: registerFooterControls,
      primaryAction: {
        id: "apply-volume-command",
        label: "Apply",
        onSelect: () => {
          void applyCommandFromQuery();
        },
        shortcutHint: "Enter",
      },
      extraActions: [
        {
          id: "mute",
          label: "Mute",
          onSelect: () => {
            void backend.system.setMute(true);
          },
          shortcutHint: "M",
        },
        {
          id: "unmute",
          label: "Unmute",
          onSelect: () => {
            void backend.system.setMute(false);
          },
        },
      ],
    };
  }, [applyCommandFromQuery, backend.system, registerFooterControls]);

  usePanelFooter(registerPanelFooter, footerConfig);

  return (
    <PanelContainer padding="md" style={{ height: "100%" }}>
      <PanelFlex direction="col" gap="sm">
        <PanelText size="lg" weight="semibold">
          Volume
        </PanelText>
        <PanelText size="xs" tone="muted">
          Use command: up, down, mute, unmute, toggle, or a number.
        </PanelText>
      </PanelFlex>

      <PanelContainer style={{ marginTop: "1rem" }}>
        <PanelSlider
          min={0}
          max={100}
          step={1}
          value={[volume]}
          onValueChange={(next) => {
            setVolume(getSliderValue(next));
          }}
          onValueCommitted={(next) => {
            void setExactVolume(getSliderValue(next));
          }}
          aria-label="Volume"
        />
      </PanelContainer>

      <PanelContainer style={{ marginTop: "0.75rem" }}>
        <PanelText size="sm">Current: {volume}%</PanelText>
        <PanelText size="xs" tone="muted">
          {message || "No command executed yet."}
        </PanelText>
      </PanelContainer>
    </PanelContainer>
  );
}
