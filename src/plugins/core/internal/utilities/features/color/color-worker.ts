import { convertColorInput } from "@/lib/utilities/color-engine";
import { getBrightnessScore, getColorKernel } from "./color-wasm-bridge";
import type { ColorWorkerRequest, ColorWorkerResponse } from "./protocol";

let kernelPromise: Promise<Awaited<ReturnType<typeof getColorKernel>>> | null = null;

self.onmessage = async (event: MessageEvent<ColorWorkerRequest>) => {
  const payload = event.data;
  if (!payload) {
    return;
  }

  try {
    const result = convertColorInput(payload.query);
    if (!kernelPromise) {
      kernelPromise = getColorKernel();
    }

    const kernel = await kernelPromise;
    const brightnessScore = result
      ? getBrightnessScore(kernel, result.channels.r, result.channels.g, result.channels.b)
      : null;

    const response: ColorWorkerResponse = {
      id: payload.id,
      result,
      brightnessScore,
    };

    self.postMessage(response);
  } catch (error) {
    const response: ColorWorkerResponse = {
      id: payload.id,
      result: null,
      brightnessScore: null,
      error: error instanceof Error ? error.message : "Failed to convert color",
    };
    self.postMessage(response);
  }
};
