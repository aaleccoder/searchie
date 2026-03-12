import type { ColorConversionResult } from "@/lib/utilities/color-engine";

export type ColorWorkerRequest = {
  id: number;
  query: string;
};

export type ColorWorkerResponse = {
  id: number;
  result: ColorConversionResult | null;
  brightnessScore: number | null;
  error?: string;
};
