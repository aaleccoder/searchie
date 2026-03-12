import * as React from "react";
import {
  Badge as PanelBadge,
  PanelContainer,
  PanelFlex,
  PanelHeading,
  Input as PanelInput,
  PanelParagraph,
  PanelText,
} from "@/plugins/sdk";
import { convertColorInput, type ColorConversionResult } from "@/lib/utilities/color-engine";
import type { ColorWorkerRequest, ColorWorkerResponse } from "./protocol";

type ColorUtilityPanelProps = {
  commandQuery: string;
};

type ResultState = {
  result: ColorConversionResult | null;
  brightnessScore: number | null;
  error: string | null;
};

function renderResult(label: string, value: string) {
  return (
    <PanelParagraph>
      <PanelText weight="semibold">{label}:</PanelText> {value}
    </PanelParagraph>
  );
}

export function ColorUtilityPanel({ commandQuery }: ColorUtilityPanelProps) {
  const [query, setQuery] = React.useState(commandQuery || "#22C55E");
  const [state, setState] = React.useState<ResultState>({
    result: convertColorInput(commandQuery || "#22C55E"),
    brightnessScore: null,
    error: null,
  });
  const workerRef = React.useRef<Worker | null>(null);
  const requestIdRef = React.useRef(0);

  React.useEffect(() => {
    setQuery(commandQuery || "#22C55E");
  }, [commandQuery]);

  React.useEffect(() => {
    if (typeof Worker === "undefined") {
      setState({
        result: convertColorInput(query),
        brightnessScore: null,
        error: null,
      });
      return;
    }

    const worker = new Worker(new URL("./color-worker.ts", import.meta.url), {
      type: "module",
    });
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<ColorWorkerResponse>) => {
      const payload = event.data;
      if (!payload || payload.id !== requestIdRef.current) {
        return;
      }

      setState({
        result: payload.result,
        brightnessScore: payload.brightnessScore,
        error: payload.error ?? null,
      });
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  React.useEffect(() => {
    const worker = workerRef.current;
    if (!worker) {
      setState({
        result: convertColorInput(query),
        brightnessScore: null,
        error: null,
      });
      return;
    }

    requestIdRef.current += 1;
    const request: ColorWorkerRequest = {
      id: requestIdRef.current,
      query,
    };
    worker.postMessage(request);
  }, [query]);

  const preview = state.result?.hex ?? "#000000";

  return (
    <PanelContainer
      padding="lg"
      radius="lg"
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: "0.9rem",
      }}
    >
      <PanelFlex align="center" justify="between">
        <PanelHeading>Color Picker</PanelHeading>
        <PanelBadge variant="secondary">WASM + JS</PanelBadge>
      </PanelFlex>

      <PanelInput
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="#22C55E, rgb(34 197 94), oklch(62.8% 0.258 29.23)"
      />

      <PanelFlex align="center" gap="sm" style={{ width: "fit-content" }}>
        <input
          type="color"
          value={preview}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Pick a color"
          style={{
            width: "44px",
            height: "32px",
            border: "1px solid color-mix(in oklab, hsl(var(--border)) 70%, transparent)",
            borderRadius: "8px",
            background: "transparent",
            padding: "2px",
          }}
        />
        <PanelParagraph size="sm" tone="muted">
          Try HEX, RGB, or OKLCH.
        </PanelParagraph>
      </PanelFlex>

      <PanelContainer
        padding="md"
        radius="lg"
        style={{
          border: "1px solid color-mix(in oklab, hsl(var(--border)) 60%, transparent)",
          backgroundColor: "color-mix(in oklab, hsl(var(--background)) 65%, transparent)",
        }}
      >
        {state.error ? <PanelParagraph tone="danger">{state.error}</PanelParagraph> : null}
        {state.result ? (
          <>
            {renderResult("HEX", state.result.hex)}
            {renderResult("RGB", state.result.rgb)}
            {renderResult("OKLCH", state.result.oklch)}
            {renderResult("HSL", state.result.hsl)}
            {state.brightnessScore !== null
              ? renderResult("WASM Brightness", `${state.brightnessScore} / 255`)
              : null}
          </>
        ) : (
          <PanelParagraph tone="muted">Use a valid color value to see conversions.</PanelParagraph>
        )}
      </PanelContainer>
    </PanelContainer>
  );
}
