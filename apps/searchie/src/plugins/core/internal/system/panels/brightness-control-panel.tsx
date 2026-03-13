import * as React from "react";
import { MonitorUp } from "lucide-react";
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
import { parseBrightnessCommand } from "@/lib/utilities/system-control-engine";
import { systemCommandScope } from "@/plugins/core/internal/system/system-command-scope";

type BrightnessControlPanelProps = {
  commandQuery: string;
  registerInputEnterHandler?: ((handler: (() => boolean | void) | null) => void) | undefined;
  registerPanelFooter?: ((footer: PanelFooterConfig | null) => void) | undefined;
  focusLauncherInput?: (() => void) | undefined;
};

function getSliderValue(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }

  if (Array.isArray(value) && typeof value[0] === "number") {
    return value[0];
  }

  return 0;
}

export function BrightnessControlPanel({
  commandQuery,
  registerInputEnterHandler,
  registerPanelFooter,
}: BrightnessControlPanelProps) {
  const backend = React.useMemo(() => createPluginBackendSdk(systemCommandScope), []);
  const [brightness, setBrightness] = React.useState<number>(50);
  const [message, setMessage] = React.useState<string>("");
  const lastAppliedQueryRef = React.useRef<string>("");
  const brightnessRef = React.useRef<number>(50);
  const confirmedBrightnessRef = React.useRef<number>(50);
  const brightnessOperationIdRef = React.useRef<number>(0);
  const { registerFooterControls } = usePanelFooterControlsRef();

  React.useEffect(() => {
    brightnessRef.current = brightness;
  }, [brightness]);

  React.useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const current = await backend.system.getBrightness();
        if (!cancelled && brightnessOperationIdRef.current === 0 && typeof current === "number") {
          const normalizedBrightness = Math.max(0, Math.min(100, current));
          brightnessRef.current = normalizedBrightness;
          confirmedBrightnessRef.current = normalizedBrightness;
          setBrightness(normalizedBrightness);
        }
      } catch (error) {
        console.error("[system-brightness] failed to read brightness", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [backend.system]);

  const applyOptimisticBrightness = React.useCallback(
    async ({
      nextValue,
      run,
      successMessage,
      failureContext,
    }: {
      nextValue: number;
      run: () => Promise<unknown>;
      successMessage: string;
      failureContext: Record<string, unknown>;
    }) => {
      const clampedValue = Math.max(0, Math.min(100, nextValue));
      const operationId = brightnessOperationIdRef.current + 1;

      brightnessOperationIdRef.current = operationId;
      brightnessRef.current = clampedValue;
      setBrightness(clampedValue);

      try {
        await run();
        brightnessRef.current = clampedValue;
        confirmedBrightnessRef.current = clampedValue;
        if (brightnessOperationIdRef.current === operationId) {
          setMessage(successMessage);
        }
        return true;
      } catch (error) {
        console.error("[system-brightness] command failed", { ...failureContext, error });
        if (brightnessOperationIdRef.current === operationId) {
          brightnessRef.current = confirmedBrightnessRef.current;
          setBrightness(confirmedBrightnessRef.current);
          setMessage("Brightness command failed.");
        }
        return false;
      }
    },
    [],
  );

  const setExactBrightness = React.useCallback(
    async (nextValue: number) => {
      const clampedValue = Math.max(0, Math.min(100, nextValue));

      return applyOptimisticBrightness({
        nextValue: clampedValue,
        run: () => backend.system.setBrightness(clampedValue),
        successMessage: `Brightness set to ${clampedValue}%.`,
        failureContext: { value: clampedValue },
      });
    },
    [applyOptimisticBrightness, backend.system],
  );

  const changeBrightnessBy = React.useCallback(
    async (delta: number, successMessage?: string) => {
      const nextValue = Math.max(0, Math.min(100, brightnessRef.current + delta));

      return applyOptimisticBrightness({
        nextValue,
        run: () => backend.system.changeBrightness(delta),
        successMessage:
          successMessage ?? `Brightness ${delta > 0 ? "increased" : "decreased"} to ${nextValue}%.`,
        failureContext: { delta, nextValue },
      });
    },
    [applyOptimisticBrightness, backend.system],
  );

  const applyCommandFromQuery = React.useCallback(async () => {
    const parsed = parseBrightnessCommand(commandQuery);
    if (!parsed) {
      return false;
    }

    if (parsed.kind === "set") {
      return setExactBrightness(parsed.value);
    }

    return changeBrightnessBy(parsed.delta);
  }, [changeBrightnessBy, commandQuery, setExactBrightness]);

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

    const parsed = parseBrightnessCommand(normalizedQuery);
    if (!parsed) {
      return;
    }

    lastAppliedQueryRef.current = normalizedQuery;
    void applyCommandFromQuery();
  }, [applyCommandFromQuery, commandQuery]);

  useHotkey(
    "ArrowRight",
    () => {
      void changeBrightnessBy(5);
    },
    { preventDefault: true },
  );

  useHotkey(
    "ArrowLeft",
    () => {
      void changeBrightnessBy(-5);
    },
    { preventDefault: true },
  );

  const footerConfig = React.useMemo<PanelFooterConfig>(() => {
    return {
      panel: {
        title: "Brightness",
        icon: MonitorUp,
      },
      registerControls: registerFooterControls,
      primaryAction: {
        id: "apply-brightness-command",
        label: "Apply",
        onSelect: () => {
          void applyCommandFromQuery();
        },
        shortcutHint: "Enter",
      },
      extraActions: [
        {
          id: "brightness-down",
          label: "Down 10%",
          onSelect: () => {
            void changeBrightnessBy(-10);
          },
          shortcutHint: "Left",
        },
        {
          id: "brightness-up",
          label: "Up 10%",
          onSelect: () => {
            void changeBrightnessBy(10);
          },
          shortcutHint: "Right",
        },
      ],
    };
  }, [applyCommandFromQuery, changeBrightnessBy, registerFooterControls]);

  usePanelFooter(registerPanelFooter, footerConfig);

  return (
    <PanelContainer padding="md" style={{ height: "100%" }}>
      <PanelFlex direction="col" gap="sm">
        <PanelText size="lg" weight="semibold">
          Brightness
        </PanelText>
        <PanelText size="xs" tone="muted">
          Use command: up, down, or set a number.
        </PanelText>
      </PanelFlex>

      <PanelContainer style={{ marginTop: "1rem" }}>
        <PanelSlider
          min={0}
          max={100}
          step={1}
          value={[brightness]}
          onValueChange={(next) => {
            setBrightness(getSliderValue(next));
          }}
          onValueCommitted={(next) => {
            void setExactBrightness(getSliderValue(next));
          }}
          aria-label="Brightness"
        />
      </PanelContainer>

      <PanelContainer style={{ marginTop: "0.75rem" }}>
        <PanelText size="sm">Current: {brightness}%</PanelText>
        <PanelText size="xs" tone="muted">
          {message || "No command executed yet."}
        </PanelText>
      </PanelContainer>
    </PanelContainer>
  );
}
