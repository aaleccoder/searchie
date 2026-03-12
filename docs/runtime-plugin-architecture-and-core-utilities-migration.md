# Runtime Plugin Architecture And Core Utilities Migration

## Current Architecture (As-Is)

- Static core plugin bootstrap still exists in `src/plugins/core/index.ts` via `buildCorePlugins()`.
- Registry wiring remains capability-validated through `src/lib/plugin-registry.ts`.
- `PanelRegistryProvider` now has a second phase that loads runtime plugins asynchronously using `loadRuntimePlugins()`:
  - file: `src/components/providers/panel-registry-provider.tsx`
  - flow: static register -> runtime async register -> rerender tick.
- Runtime plugin loader exists and is manifest-aware:
  - file: `src/plugins/runtime/runtime-plugin-loader.ts`
  - current source list: `RUNTIME_PLUGIN_ENTRIES` (in-project module imports).
- Runtime module example exists for color plugin:
  - file: `src/plugins/runtime/modules/color-runtime-plugin.tsx`
  - manifest source: `src/plugins/core/internal/utilities/features/color/manifest.json`.
- Utilities still static except color:
  - file: `src/plugins/core/internal/utilities/descriptors.tsx`
  - still static: file-search, calc, conversion, glyph-picker, google-search.

## Target State For Core Utilities

Migrate each utility feature to the runtime module pattern used by `utilities-color`.

For each utility feature, standardize to:
- `src/plugins/core/internal/utilities/features/<feature>/manifest.json`
- `src/plugins/runtime/modules/<feature>-runtime-plugin.tsx`
- `src/plugins/runtime/runtime-plugin-loader.ts` entry in `RUNTIME_PLUGIN_ENTRIES`

This keeps implementation source in the feature folder while registration source moves to runtime modules.

## Recommended Migration Order (Lowest Risk First)

1. `utilities-convert`
2. `utilities-calc`
3. `utilities-glyph-picker`
4. `utilities-google-search`
5. `utilities-file-search` (last because it has command/keyboard/footer complexity and backend capabilities)

## Safe Migration Playbook (Per Utility)

1. Add manifest file
- Create `features/<feature>/manifest.json` with:
  - `id`, `name`, `entry`, optional `wasm` metadata.
- Keep IDs/aliases exactly the same as existing static descriptor.

2. Add runtime module
- Create `src/plugins/runtime/modules/<feature>-runtime-plugin.tsx`.
- Import manifest JSON and build descriptor with `defineCorePlugin` + `definePluginPanel`.
- Reuse existing panel component from feature folder.
- Keep capabilities unchanged.

3. Register module in runtime loader
- Add `importModule` entry in `RUNTIME_PLUGIN_ENTRIES`.
- Keep loader validation (`isValidManifestShape`) strict.

4. Remove static registration for that feature
- Remove panel creation from `src/plugins/core/internal/utilities/descriptors.tsx`.
- Keep feature code untouched unless alias/component signatures need adaptation.

5. Preserve alias behavior
- Ensure aliases are still sourced from `src/plugins/core/internal/utilities/aliases.ts`.
- No alias normalization changes unless fully tested.

6. Test before next feature (TDD loop)
- Add/adjust tests first, then migrate code.
- Required checks:
  - Runtime loader test: plugin loads.
  - Registry integration test: alias resolves panel id.
  - Existing utility panel behavior tests stay green.

## Safety Rules

- Do not change panel ids during migration.
- Do not broaden capabilities during migration.
- Keep one feature migration per PR/commit batch.
- Prefer additive first, then remove static path once runtime path passes tests.
- If both static and runtime register the same id, registration will fail; remove static descriptor in the same change.
- Keep runtime load failures non-fatal (`console.warn` + skip plugin).
- Keep runtime module boundaries small; avoid giant module files.

## Runtime Loader Hardening (Next)

After utilities migration is complete, harden loader with:
- manifest schema version (`apiVersion`, `pluginVersion`),
- deterministic module ordering/priority policy,
- duplicate plugin id and duplicate panel id pre-checks before register,
- optional runtime feature flags per module.

## Verification Checklist

- `bun run test` passes fully.
- Utility registration tests still pass for static utilities that remain.
- Runtime integration tests pass for migrated utilities.
- Manual launcher checks:
  - alias opens right panel,
  - keyboard behavior unchanged,
  - footer behavior unchanged,
  - capability-protected actions still enforce permissions.

## Scope Boundary

Included here:
- in-project runtime module migration for core utilities.

Explicitly excluded here:
- zip/external plugin installation,
- signature/trust distribution pipeline,
- persisted plugin install catalog.
