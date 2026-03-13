// tsup.config.ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'], // Your main entry point
  format: ['cjs', 'esm'], // Output both CommonJS and ESM
  dts: true, // Generate TypeScript declaration files
  splitting: false,
  sourcemap: true,
  clean: true, // Clean the dist folder before build
  external: [
    'react',
    'react-dom',
    '@tanstack/react-virtual',
  ],
  treeshake: true,
  minify: false, // Keep readable for debugging during development
  target: 'es2020',
  outDir: 'dist',
});