export type ColorUtilityManifest = {
  id: string;
  name: string;
  entry: string;
  wasm: {
    path: string;
    exports: string[];
  };
};

// Keep this in sync with manifest.json for easy future dynamic loading.
export const COLOR_UTILITY_MANIFEST: ColorUtilityManifest = {
  id: "utilities-color",
  name: "Color Utility",
  entry: "./index.ts",
  wasm: {
    path: "/wasm/color-kernel.wasm",
    exports: ["add"],
  },
};
