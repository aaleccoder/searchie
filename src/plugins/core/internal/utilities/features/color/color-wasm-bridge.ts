import { COLOR_UTILITY_MANIFEST } from "./index";

type ColorKernelExports = WebAssembly.Exports & {
  add?: (a: number, b: number) => number;
};

export type ColorKernel = {
  add: (a: number, b: number) => number;
};

let kernelPromise: Promise<ColorKernel | null> | null = null;

async function loadKernel(): Promise<ColorKernel | null> {
  try {
    const response = await fetch(COLOR_UTILITY_MANIFEST.wasm.path);
    if (!response.ok) {
      return null;
    }

    const bytes = await response.arrayBuffer();
    const module = await WebAssembly.instantiate(bytes, {});
    const exports = module.instance.exports as ColorKernelExports;

    if (typeof exports.add !== "function") {
      return null;
    }

    return {
      add: exports.add,
    };
  } catch {
    return null;
  }
}

export function getColorKernel(): Promise<ColorKernel | null> {
  if (!kernelPromise) {
    kernelPromise = loadKernel();
  }

  return kernelPromise;
}

export function getBrightnessScore(kernel: ColorKernel | null, r: number, g: number, b: number): number | null {
  if (!kernel) {
    return null;
  }

  const rg = kernel.add(r, g);
  const total = kernel.add(rg, b);
  return Math.round(total / 3);
}
