# Use TDD always.
# Always use bun for the package manager.
# Do not do builds or run the app yourself. Try to look at the current open terminals, if not ask the user for logs.
# Always use shadcn components.
# Not a single file should be longer than 500 lines unless totally needed.

## Panel And Functionality Extension Guide

### Core Architecture Rules
- Never hardcode panel commands inside `src/components/launcher-panel.tsx`.
- Register panels through `src/components/providers/panel-registry-provider.tsx`.
- Define panel descriptors using `ShortcutPanelDescriptor` from `src/lib/panel-contract.ts`.
- Use `createPrefixAliasMatcher` from `src/lib/panel-matchers.ts` for command-based activation.
- If panel needs Tauri commands, use `invokePanelCommand` from `src/lib/tauri-commands.ts`.
- Do not call raw `invoke(...)` directly inside new panel features unless absolutely required.

### How To Add A New Panel
1. Add panel UI component under `src/components/panels/<feature>/...`.
2. Create aliases map (including multilingual aliases when relevant).
3. Build a descriptor with `id`, `name`, `aliases`, `matcher`, `component`, and `capabilities`.
4. Register descriptor in `panel-registry-provider.tsx` (or through a local builder function that returns descriptors).
5. Keep launcher untouched except generic behavior (no feature-specific branches).

### How To Add A New Utility Module
1. Put pure logic in `src/lib/utilities/<module>-engine.ts`.
2. Put rendering in `src/components/panels/utilities/<module>-utility-panel.tsx`.
3. Wire aliases in `src/components/panels/utilities/aliases.ts`.
4. Register through `src/components/panels/utilities/index.tsx` and provider.

### Multilingual Command Rules
- Keep aliases normalized and lowercase.
- Group aliases by locale in an alias map and flatten for registration.
- Prefer short commands + natural words (example: `calc`, `calcular`, `rechnen`).
- For converters, normalize natural language units in the engine (example: `miles` -> `mi`).

### Backend Feature Rules (Tauri)
- Keep event names in `src-tauri/src/features/events.rs` constants.
- If adding backend feature metadata, update `src-tauri/src/features/mod.rs` and provider modules.
- Avoid duplicating raw event strings in command modules.

### Required Tests Before Implementation (Red -> Green -> Refactor)
- Add/adjust unit tests for parsing and core logic first.
- Add registry matching tests for new aliases.
- Add integration tests when panel behavior affects launcher flow.
- Run `bun run test` and ensure all suites are green.

### Required Tests For New Panels
- Alias matching test.
- Descriptor registration test.
- Core engine test (if logic-heavy panel).
- Failure path test (invalid input or unsupported operation).

### Quality And Safety Checks
- Keep every new file under 500 lines unless justified.
- Prefer small focused modules over monolithic files.
- Keep UI on shadcn components.
- If capability checks are needed, add capability entries once and enforce through wrapper.