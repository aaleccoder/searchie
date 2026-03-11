# Searchie

A fast, keyboard-driven Windows app launcher built with Tauri, React, and TypeScript.

### Features

- **App Launcher** - Search, launch, and manage your installed applications
- **Clipboard History** - Search and reuse clipboard items
- **File Search** - Quickly find files on your system
- **Calculator** - Quick calculations directly from the launcher
- **Unit Converter** - Convert between different units
- **Keyboard-driven** - Full keyboard navigation support

### Requirements

- Windows 10/11

### Development

This is a Tauri + React + TypeScript application.

#### Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

### Status

This is a personal project focused on what I need. Here's the reality:

- **Windows only** - For now, I have no plans to support other platforms. macOS and Linux users will need to look elsewhere.
- **No plugins** - I don't care about plugin systems and have no intention of adding one. The features you see are the features you get.

Built with Tauri, React, TypeScript, and shadcn/ui.

## Panel Creation Guide

This document explains how to add a new launcher panel in Searchie and how to design it so it matches the quality bar of the main Apps launcher panel (the insignia panel).

### Objective

- Build new panel features through the panel registry architecture, not by hardcoding logic into the launcher.
- Keep behavior keyboard-first, fast, and predictable.
- Match the visual and interaction standards established by `src/components/panels/apps/apps-launcher-panel.tsx`.
- Keep implementation modular and testable.

### Core Contracts You Must Use

These are the core files you should read before writing a panel.

- `src/lib/panel-contract.ts`
- `src/lib/panel-matchers.ts`
- `src/lib/panel-shortcuts.ts`
- `src/components/providers/panel-registry-provider.tsx`
- `src/components/panels/apps/apps-launcher-panel.tsx`

#### `ShortcutPanelDescriptor` Checklist

Every panel must provide a `ShortcutPanelDescriptor` with:

- `id`: stable unique id.
- `name`: user-facing name.
- `aliases`: lowercase command aliases.
- `capabilities`: explicit required permissions/capabilities.
- `matcher`: command matching logic.
- `component`: React component receiving `PanelRenderProps`.

Optional but strongly recommended:

- `commandIcon`: icon shown in command suggestions.
- `priority`: deterministic ordering when needed.
- `searchIntegration`: defines activation and escape behavior.
- `shortcuts`: visible key hint metadata.
- `onInputKeyDown`: advanced key interception only when necessary.

### Architecture Rules

Follow these workspace rules consistently:

- Do not hardcode panel-specific behavior in `src/components/launcher-panel.tsx`.
- Register panel descriptors through `src/components/providers/panel-registry-provider.tsx`.
- Use `createPrefixAliasMatcher` from `src/lib/panel-matchers.ts` unless there is a strong reason not to.
- If the panel calls Tauri commands, call `invokePanelCommand` from `src/lib/tauri-commands.ts` instead of direct `invoke(...)`.
- Keep logic and UI separated for utility-style features:
	- Core logic in `src/lib/utilities/<module>-engine.ts`
	- Panel UI in `src/components/panels/utilities/<module>-utility-panel.tsx`

### Step-By-Step: Add A New Panel

1. Create the panel component in the correct area.
2. Define aliases (include multilingual aliases where relevant).
3. Build a descriptor that satisfies `ShortcutPanelDescriptor`.
4. Register the descriptor in `PanelRegistryProvider`.
5. Add tests before implementation changes (TDD flow).
6. Validate keyboard behavior, focus transitions, and shortcut hints.

#### 1) Create Panel UI Component

- Put app-oriented panels under `src/components/panels/apps/...`.
- Put utility panels under `src/components/panels/utilities/...`.
- Use shadcn components from `src/components/ui/*`.
- Keep components focused; avoid monolithic files.

#### 2) Define Aliases

Alias rules:

- Normalize to lowercase.
- Keep commands short and natural.
- Support locale variants when useful.
- Ensure aliases do not conflict with existing panel aliases.

Use `createPrefixAliasMatcher(aliases)` for command parsing.

Matching behavior from `createPrefixAliasMatcher`:

- `"alias"` activates with empty `commandQuery`.
- `"alias something"` activates with `commandQuery = "something"`.
- No alias match means panel does not activate.

#### 3) Build Descriptor

Use this template:

```tsx
import type { ShortcutPanelDescriptor } from "@/lib/panel-contract";
import { createPrefixAliasMatcher } from "@/lib/panel-matchers";

const aliases = ["example", "ex"];

export const examplePanel: ShortcutPanelDescriptor = {
	id: "example",
	name: "Example",
	aliases,
	capabilities: ["settings.read"],
	priority: 40,
	searchIntegration: {
		activationMode: "result-item", // or "immediate"
		placeholder: "Search example...",
		exitOnEscape: true,
	},
	shortcuts: [{ keys: "Escape", description: "Back to launcher commands" }],
	matcher: createPrefixAliasMatcher(aliases),
	component: ({ commandQuery, focusLauncherInput }) => (
		<ExamplePanel commandQuery={commandQuery} focusLauncherInput={focusLauncherInput} />
	),
};
```

#### 4) Register In Provider

Register in `src/components/providers/panel-registry-provider.tsx` using existing pattern:

- `nextRegistry.register(examplePanel)`
- Keep registration order intentional.
- Avoid conditional registration unless feature capability requires it.

#### 5) Integrate Search Behavior Correctly

Choose activation mode deliberately:

- `immediate`: panel opens as soon as matcher matches query.
- `result-item`: panel appears in launcher command suggestions and opens on Enter/click.

Use `searchIntegration.placeholder` so the search input reflects panel context.

#### 6) Publish Shortcut Hints

If your panel has custom keyboard model, set `descriptor.shortcuts`.

If omitted, `resolveLauncherShortcutHints` in `src/lib/panel-shortcuts.ts` falls back to panel-specific defaults only when provided in fallback map. If no panel-specific hints exist, users see a generic Escape hint.

## UX And UI Guidelines (Insignia Standard)

Treat `AppsLauncherPanel` as the reference for quality and interaction maturity.

### Layout Structure

Preferred structure for feature-rich panels:

- Two-column layout.
- Left pane: primary results list.
- Right pane: contextual detail/actions for selected item.

From insignia panel:

- Root grid: `grid h-full grid-cols-[1.45fr_1fr] gap-2.5 items-stretch`
- Left list inside `ScrollArea` for long results.
- Right side as a stable context pane, not a modal.

#### Navigation Model

Keyboard-first is mandatory.

- `ArrowUp/ArrowDown`: move selection.
- `Enter`: activate selected item/action.
- `ArrowRight/ArrowLeft`: switch between list and action column when applicable.
- `Escape`: return focus to launcher input or exit panel session based on `searchIntegration.exitOnEscape`.

Focus behavior requirements:

- Track current selection id/index in state.
- Keep refs for focusable list/action items.
- Scroll selected item into view (`scrollIntoView({ block: "nearest" })`).
- Never trap focus.

#### Query And Performance Behavior

- Debounce expensive search operations (`useDebouncedValue` pattern).
- Show bounded result sets to keep rendering snappy.
- Maintain stable selection when result list updates.
- Avoid unnecessary re-renders by deriving lists via `useMemo`.

#### Action Model

- Actions should be explicit buttons with labels and hints.
- Disable unsupported actions instead of hiding them when discoverability matters.
- Show pending state during async actions (`busy`, `busyActionId` style).
- Log actionable errors (`console.error` with context object).

#### Visual Language

Use the same tone as insignia panel:

- Rounded cards/buttons with subtle borders.
- Selected row styling distinct but not noisy.
- Small metadata text in muted foreground.
- Use `SingleLineTooltipText`-style truncation + tooltip for long paths/names.

Recommended classes and patterns to reuse:

- Interactive row: `rounded-lg border px-3 py-2 transition`
- Active row: `border-primary/70 bg-primary/10`
- Idle row hover: `border-transparent hover:border-primary/40 hover:bg-accent/50`
- Metadata: `text-xs text-muted-foreground`

#### Empty, Loading, And Error States

- Empty results: clear one-line message (example: `No apps found.`).
- Loading/pending actions: show text change or disabled button state.
- Errors: do not crash panel; log details and preserve usable UI.

#### Input-Handler Integration

If the panel has list navigation controlled from launcher input:

- Wire `registerInputArrowDownHandler` to move focus into first result.
- Wire `registerInputEnterHandler` to activate current selection.
- Clear handlers on unmount.

This keeps launcher input and panel body synchronized.

### Capability And Backend Guidelines

- Declare only capabilities you need in descriptor.
- Use `invokePanelCommand(scope, command, payload)` with a `PanelCommandScope` matching those capabilities.
- Keep backend event names/constants centralized in Rust feature modules when adding backend features.
- Avoid duplicating raw event strings in command modules.

### Testing Requirements (TDD)

Required process:

1. Write failing tests first.
2. Implement minimal code to pass.
3. Refactor while keeping tests green.

Minimum tests for new panels:

- Alias matching test.
- Descriptor registration test.
- Core engine test (for logic-heavy panels).
- Failure-path test (invalid input/unsupported operation).

Also add integration coverage when panel behavior affects launcher flow.

### Review Checklist Before Merge

- Panel defined as `ShortcutPanelDescriptor` with clear id/aliases/capabilities.
- Registered through provider, not hardcoded in launcher.
- Uses `createPrefixAliasMatcher` or documented alternative matcher.
- Search mode (`immediate` vs `result-item`) intentionally chosen.
- Keyboard navigation complete and predictable.
- Focus transitions tested (input <-> list <-> actions).
- Shortcut hints shown and accurate.
- Async actions handle busy + error states.
- UI uses shadcn primitives and matches insignia interaction quality.
- Tests added and passing.

### Anti-Patterns To Avoid

- Adding panel-specific branching logic in `launcher-panel.tsx`.
- Calling raw Tauri `invoke(...)` inside panel features.
- Hiding unavailable actions without feedback when user intent exists.
- Breaking keyboard flow by relying on mouse-only interactions.
- Returning huge unbounded result lists.
- Introducing aliases that overlap heavily with existing high-priority panels.

### Reference Files

- `src/lib/panel-contract.ts`
- `src/lib/panel-matchers.ts`
- `src/lib/panel-shortcuts.ts`
- `src/components/providers/panel-registry-provider.tsx`
- `src/components/panels/apps/apps-launcher-panel.tsx`
- `src/components/panels/apps/index.tsx`
- `src/components/launcher-panel.tsx`
