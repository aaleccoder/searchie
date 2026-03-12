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
- **No third-party plugins** - Searchie uses an internal core-plugin architecture, but does not expose external plugin loading.

Built with Tauri, React, TypeScript, and shadcn/ui.

## Panel Creation Guide

This document explains how to add a new launcher panel in Searchie and how to design it so it matches the quality bar of the main Apps launcher panel (the insignia panel).

### Objective

- Build new panel features through the panel registry architecture, not by hardcoding logic into the launcher.
- Keep behavior keyboard-first, fast, and predictable.
- Match the visual and interaction standards established by `src/plugins/core/internal/apps/panels/apps-launcher-panel.tsx`.
- Keep implementation modular and testable.

### Core Contracts You Must Use

These are the core files you should read before writing a panel.

- `src/lib/panel-contract.ts`
- `src/lib/panel-matchers.ts`
- `src/lib/panel-shortcuts.ts`
- `src/lib/plugin-contract.ts`
- `src/components/providers/panel-registry-provider.tsx`
- `src/plugins/core/index.ts`
- `src/plugins/core/internal/apps/panels/apps-launcher-panel.tsx`

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

### Panel Actions Footer API (Raycast-style)

Panels can publish a dynamic footer with:

- panel metadata (`panel.title`, optional `panel.icon`) used as the footer label
- one `primaryAction`
- multiple `extraActions` (dropdown)
- per-action icon, disabled/loading states, destructive style, and shortcut hint
- panel-owned imperative controls (`openExtraActions`, `runExtraActionById`, etc.)

This lets each panel fully control footer behavior without hardcoding feature logic in the launcher.

#### Contract Types

See `src/lib/panel-contract.ts`:

- `PanelFooterAction`
- `PanelFooterMeta`
- `PanelFooterConfig`
- `PanelFooterControls`
- `PanelRenderProps.registerPanelFooter`

#### How To Use In A Panel

1. Build your footer config in `useMemo` based on currently selected item.
2. Register it via `registerPanelFooter(footerConfig)` in `useEffect`.
3. Register footer controls (`registerControls`) into a local ref.
4. Wire panel hotkeys (for example `Alt+K`) to call `footerControlsRef.current?.openExtraActions()`.
5. Keep action execution item-scoped so actions always apply to the current selection.

Example:

```tsx
import * as React from "react";
import { FolderOpen, Rocket, Trash2 } from "lucide-react";
import { useHotkey } from "@tanstack/react-hotkeys";
import type { PanelFooterConfig, PanelFooterControls } from "@/lib/panel-contract";

function ExamplePanel({
	registerPanelFooter,
}: {
	registerPanelFooter?: (footer: PanelFooterConfig | null) => void;
}) {
	const [selectedItem, setSelectedItem] = React.useState<{ id: string; name: string } | null>(null);
	const footerControlsRef = React.useRef<PanelFooterControls | null>(null);

	const footerConfig = React.useMemo<PanelFooterConfig | null>(() => {
		if (!selectedItem) {
			return null;
		}

		return {
			panel: {
				title: "Example",
				icon: FolderOpen,
			},
			registerControls: (controls) => {
				footerControlsRef.current = controls;
			},
			primaryAction: {
				id: "open",
				label: "Open",
				icon: FolderOpen,
				onSelect: () => {
					// Run open for selectedItem.id
				},
				shortcutHint: "Enter",
			},
			extraActions: [
				{
					id: "run",
					label: "Run",
					icon: Rocket,
					onSelect: () => {
						// Run action for selectedItem.id
					},
					shortcutHint: "Alt+R",
				},
				{
					id: "delete",
					label: "Delete",
					icon: Trash2,
					destructive: true,
					onSelect: () => {
						// Delete selectedItem.id
					},
					shortcutHint: "Alt+D",
				},
			],
		};
	}, [selectedItem]);

	React.useEffect(() => {
		registerPanelFooter?.(footerConfig);
		return () => {
			registerPanelFooter?.(null);
		};
	}, [footerConfig, registerPanelFooter]);

	useHotkey(
		"Alt+K",
		() => {
			footerControlsRef.current?.openExtraActions();
		},
		{ enabled: !!selectedItem, preventDefault: true },
	);

	useHotkey(
		"Alt+D",
		() => {
			footerControlsRef.current?.runExtraActionById("delete");
		},
		{ enabled: !!selectedItem, preventDefault: true },
	);

	return <div>{/* panel UI */}</div>;
}
```

#### Keyboard + Focus Rules For Footer Actions

- `Alt+K` (or any panel-defined hotkey) should be handled by the panel, not the footer.
- Footer dropdown keyboard navigation is handled by the dropdown component.
- Closing dropdown with `Escape` returns focus to the previously focused element automatically.
- Direct extra-action hotkeys should call `runExtraActionById(actionId)` to preserve item context.

#### Do / Don't

- Do define action ids and shortcuts in the panel itself.
- Do keep action handlers bound to selected item state.
- Do expose these shortcuts in descriptor `shortcuts` metadata.
- Don't put panel-specific footer logic in `launcher-panel.tsx`.

### Architecture Rules

Follow these workspace rules consistently:

- Do not hardcode panel-specific behavior in `src/components/launcher-panel.tsx`.
- Register panels in plugin descriptors under `src/plugins/core/*` and `src/plugins/core/internal/*`; provider registration happens automatically through `buildCorePlugins()`.
- Use `createPrefixAliasMatcher` from `src/lib/panel-matchers.ts` unless there is a strong reason not to.
- Always use `src/components/framework/panel-primitives.tsx` for panel UI primitives (layout, text, list, buttons, empty states, scroll areas, etc.) instead of importing raw UI primitives directly.
- If the panel calls Tauri commands, call `invokePanelCommand` from `src/lib/tauri-commands.ts` instead of direct `invoke(...)`.
- Keep logic and UI separated for utility-style features:
	- Core logic in `src/lib/utilities/<module>-engine.ts`
	- Panel UI in `src/plugins/core/internal/<plugin>/...`
- Utility panels must reuse the launcher input as the single query input source.
	- Do not add a second, panel-local search field.
	- Parse and react to `commandQuery` from `PanelRenderProps`.
- Do not wrap panel root panes with heavy card wrappers by default (for example: `rounded-xl border border-border/70 bg-card/92 shadow-lg`) unless the existing panel family already uses that exact wrapper pattern.

### Step-By-Step: Add A New Core Plugin Panel

1. Choose the plugin scope (`apps`, `clipboard`, `system`, `utilities`).
2. Create the panel component in the plugin's `panels/` or `features/<feature>/` directory.
3. Define aliases (include multilingual aliases where relevant).
4. Build a descriptor that satisfies `ShortcutPanelDescriptor`.
5. Register/export the descriptor via the plugin's `descriptors.tsx` and plugin factory (`src/plugins/core/<plugin>.tsx`).
6. Add tests before implementation changes (TDD flow).
7. Validate keyboard behavior, focus transitions, and shortcut hints.

#### 1) Create Panel UI Component

- Put app-oriented panels under `src/plugins/core/internal/apps/panels/...`.
- Put clipboard panels under `src/plugins/core/internal/clipboard/panels/...`.
- Put system panels under `src/plugins/core/internal/system/panels/...`.
- Put utility panels under `src/plugins/core/internal/utilities/features/<feature>/...`.
- Build panel UI with primitives from `src/components/framework/panel-primitives.tsx`.
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

#### 4) Register In Plugin Descriptors

Register through the core plugin structure (not directly in the provider):

- Add descriptor to the plugin internal descriptor builder, for example `src/plugins/core/internal/utilities/descriptors.tsx`.
- Ensure the plugin factory returns those panels in `src/plugins/core/<plugin>.tsx`.
- Keep plugin order intentional in `src/plugins/core/index.ts` (`buildCorePlugins`).
- `PanelRegistryProvider` already registers all plugin panels from `buildCorePlugins()`.

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

Required parity with `src/plugins/core/internal/apps/panels/apps-launcher-panel.tsx` behavior:

- Wire panel-level hotkeys so navigation works even when focus shifts inside panel regions.
- Implement both input-level interception (`onInputKeyDown` + input handler registration) and in-panel key handling when needed.
- `ArrowUp` from first list item should return focus to launcher input.
- `ArrowLeft` should move from actions back to list, and from list back to launcher input when appropriate.
- `Escape` should consistently return focus to launcher input for in-panel contexts.

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
- Adding a second search input inside a panel when launcher input already exists.
- Repeating heavyweight shell wrappers (`rounded-xl border border-border/70 bg-card/92 shadow-lg`) across panel sections without a deliberate design reason.
- Hiding unavailable actions without feedback when user intent exists.
- Breaking keyboard flow by relying on mouse-only interactions.
- Returning huge unbounded result lists.
- Introducing aliases that overlap heavily with existing high-priority panels.

### Reference Files

- `src/lib/panel-contract.ts`
- `src/lib/panel-matchers.ts`
- `src/lib/panel-shortcuts.ts`
- `src/lib/plugin-contract.ts`
- `src/components/providers/panel-registry-provider.tsx`
- `src/components/framework/panel-primitives.tsx`
- `src/plugins/core/index.ts`
- `src/plugins/core/apps.tsx`
- `src/plugins/core/clipboard.tsx`
- `src/plugins/core/system.tsx`
- `src/plugins/core/utilities.tsx`
- `src/plugins/core/internal/apps/panels/apps-launcher-panel.tsx`
- `src/components/launcher-panel.tsx`
