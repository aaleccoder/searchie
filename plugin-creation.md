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

### Direct Commands

Searchie now supports first-class direct commands in addition to panels.

Use a direct command when the feature should behave like a one-shot launcher action instead of opening a dedicated panel session.

Examples:

- `brightness up`
- `brightness down`
- `brightness 60`
- future command-style actions such as mute, Wi-Fi toggle, or Bluetooth off

Direct commands are designed to appear in launcher results like normal app-style suggestions.

Current behavior:

- They can appear in the top-level launcher suggestion list.
- They can be injected into the default Apps launcher results.
- They only appear for non-empty queries.
- Exact actionable matches rank ahead of fuzzy matches.
- Similar text can still surface a command suggestion even if the matcher does not fully match yet.
- They do not execute automatically while typing.
- They execute only when the user explicitly selects them with `Enter` or click.

Use a panel instead when:

- the feature needs a multi-step UI
- the user needs to browse a result list
- the action depends on persistent local selection state
- the feature exposes a richer action footer or detail pane

Use a direct command instead when:

- the user intent is a single action
- the query can be parsed into one command payload
- no extra panel context is required before execution

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

#### `ShortcutCommandDescriptor` Checklist

Every direct command must provide a `ShortcutCommandDescriptor` with:

- `id`: stable unique id.
- `name`: user-facing name.
- `aliases`: lowercase command aliases.
- `capabilities`: explicit required permissions/capabilities.
- `matcher`: query matching logic.
- `execute`: async or sync action handler receiving execution context.

Optional but strongly recommended:

- `commandIcon`: icon shown in launcher/App suggestions.
- `priority`: deterministic ordering when multiple commands match.
- `getLabel`: custom result label derived from the current query.
- `appsLauncherIntegration`: whether the command should also appear in Apps results.

Execution context currently includes:

- `source`: `launcher` or `apps`
- `rawQuery`: full query string the user typed
- `commandQuery`: the matcher-extracted payload
- optional helpers such as `clearLauncherInput`, `closeLauncherWindow`, and `focusLauncherInput`

This lets a command execute through the shared launcher flow without owning a React panel component.

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
- Do not hardcode command-specific behavior in `src/components/launcher-panel.tsx`.
- Register panels in plugin descriptors under `src/plugins/core/*` and `src/plugins/core/internal/*`; provider registration happens automatically through `buildCorePlugins()`.
- Register direct commands in plugin descriptors under `src/plugins/core/*` and `src/plugins/core/internal/*`; provider registration happens automatically through `buildCorePlugins()`.
- Use `createPrefixAliasMatcher` from `src/lib/panel-matchers.ts` unless there is a strong reason not to.
- A direct command may use `createPrefixAliasMatcher`, but it can also use a stricter custom matcher when it should only count as actionable for certain query shapes.
- Always use `src/components/framework/panel-primitives.tsx` for panel UI primitives (layout, text, list, buttons, empty states, scroll areas, etc.) instead of importing raw UI primitives directly.
- If the panel calls Tauri commands, call `invokePanelCommand` from `src/lib/tauri-commands.ts` instead of direct `invoke(...)`.
- If the direct command calls Tauri commands, route it through the shared plugin backend SDK or `invokePanelCommand` with the correct capability scope.
- Keep logic and UI separated for utility-style features:
	- Core logic in `src/lib/utilities/<module>-engine.ts`
	- Panel UI in `src/plugins/core/internal/<plugin>/...`
- Keep direct command parsing logic in reusable engine/util files when the command is logic-heavy.
- Utility panels must reuse the launcher input as the single query input source.
	- Do not add a second, panel-local search field.
	- Parse and react to `commandQuery` from `PanelRenderProps`.
- Do not wrap panel root panes with heavy card wrappers by default (for example: `rounded-xl border border-border/70 bg-card/92 shadow-lg`) unless the existing panel family already uses that exact wrapper pattern.

### Panel Primitives Styling (Required)

Panel UI should be composed from `src/components/framework/panel-primitives.tsx` first, and only then use inline `style` for values that primitives do not currently expose.

#### Preferred Layout Skeleton

Use this baseline structure for list/detail panels:

```tsx
<PanelGrid columns="two-pane" gap="sm" style={{ height: "100%" }}>
	<PanelSection style={{ height: "100%", overflow: "hidden" }}>
		<PanelScrollArea style={{ height: "100%" }}>
			<PanelContainer padding="md">
				<PanelList gap="sm">{/* rows */}</PanelList>
			</PanelContainer>
		</PanelScrollArea>
	</PanelSection>

	<PanelAside>
		<PanelContainer padding="md">{/* contextual details/actions */}</PanelContainer>
	</PanelAside>
</PanelGrid>
```

#### Primitive-First Styling Rules

- Use `PanelContainer` tokens before custom CSS:
	- `padding="xs|sm|md|lg"`
	- `radius="sm|md|lg"`
	- `surface="muted|panel"`
- Use `PanelFlex` and `PanelGrid` for spacing/alignment instead of manual wrappers.
- Use `PanelText` and `PanelParagraph` props (`size`, `tone`, `weight`, `truncate`, `mono`) before custom typography styles.
- Keep inline `style` only for truly custom values such as exact pixel heights, `backdropFilter`, or non-token border/gradient values.

#### List Item Selection (New Standard)

`PanelListItem` supports `active` directly. Use it instead of manually setting selected row background/border styles.

```tsx
<PanelListItem
	active={index === selectedIndex}
	onMouseEnter={() => setSelectedIndex(index)}
	onClick={() => runAction(items[index])}
>
	<PanelText truncate>{items[index].label}</PanelText>
</PanelListItem>
```

Do not do this unless there is a deliberate visual exception:

- manually setting selected state via `style={{ backgroundColor: ... }}` on each row
- duplicating active/idle class logic outside primitives

#### Interaction Composition Pattern

- List area: `PanelScrollArea` + `PanelList` + `PanelListItem`.
- Details area: `PanelMetaGrid` for label/value pairs and `PanelFlex` for action hints.
- Empty state: `PanelEmpty`, `PanelEmptyHeader`, `PanelEmptyMedia`, `PanelEmptyTitle`, `PanelEmptyDescription`.
- Keyboard hints: use `PanelKbd` and `PanelKbdGroup` when hints are shown in-panel.

#### Build Checklist For New Panels

1. Define matcher + aliases in descriptor (`createPrefixAliasMatcher` in most cases).
2. Build UI with panel primitives only.
3. Use launcher input (`commandQuery`) as the single query source.
4. Add keyboard bridges (`registerInputArrowDownHandler`, `registerInputEnterHandler`) when needed.
5. Publish footer actions through `registerPanelFooter` instead of launcher hardcoding.
6. Keep selection state stable across result updates.
7. Use `PanelListItem active={...}` for row selection visuals.
8. Add/adjust tests (alias matching, descriptor registration, core behavior, failure path).

### Step-By-Step: Add A New Core Plugin Panel

The plugin system now supports two interaction types:

- panels
- direct commands

Choose intentionally.

- Add a panel if the feature needs UI state, list navigation, detail panes, or footer actions.
- Add a direct command if the feature is a one-shot action that should feel like launching an app from results.

## Step-By-Step: Add A New Direct Command

1. Choose the plugin scope (`system`, `utilities`, or another plugin area that already owns the capability).
2. Put parsing and normalization logic in a reusable engine/util file when the command is not trivial.
3. Define aliases and matcher behavior.
4. Build a `ShortcutCommandDescriptor`.
5. Register it through the plugin factory in `src/plugins/core/<plugin>.tsx` using the plugin `commands` field.
6. Add tests before implementation changes.
7. Validate both launcher surfaces:
	- top-level launcher suggestions
	- injected Apps suggestions when `appsLauncherIntegration.injectAsApp` is enabled

### Direct Command Descriptor Template

```tsx
import { Zap } from "lucide-react";
import type { ShortcutCommandDescriptor } from "@/lib/panel-contract";
import { createPrefixAliasMatcher } from "@/lib/panel-matchers";
import { createPluginBackendSdk, definePluginCommand } from "@/plugins/sdk";

const aliases = ["brightness up", "bright up"];

export const brightnessUpCommand: ShortcutCommandDescriptor = definePluginCommand({
	id: "system-brightness-up",
	name: "Brightness Up",
	aliases,
	commandIcon: Zap,
	capabilities: ["system.brightness"],
	priority: 40,
	appsLauncherIntegration: {
		injectAsApp: true,
	},
	matcher: createPrefixAliasMatcher(aliases),
	execute: async ({ commandQuery, source }) => {
		// Run a one-shot action here
		// `source` tells you whether it was launched from top-level launcher or Apps
	},
});
```

### Recommended Direct Command Pattern

Use direct commands for parsing-driven actions.

Example pattern:

1. Match alias prefix.
2. Parse `commandQuery` into a typed intent.
3. If parsing succeeds, execute a one-shot backend action.
4. If parsing fails, let the command still appear as a fuzzy suggestion when the query is similar.

This is how Searchie currently treats command-style actions so they remain discoverable before the query is fully complete.

### Direct Command Labeling

Use `getLabel` when the visible result title should reflect parsed intent.

Examples:

- `Brightness Up`
- `Brightness Down`
- `Set Brightness to 55%`

This is especially useful when one descriptor can represent multiple command variants.

### Direct Command Registration

Register commands through the plugin descriptor, not the launcher.

Example:

```tsx
import { defineCorePlugin } from "@/plugins/sdk";

export const systemPlugin = defineCorePlugin({
	id: "core.system",
	name: "Core System",
	version: "0.1.0",
	permissions: ["system.brightness"],
	panels: [],
	commands: [brightnessUpCommand],
});
```

The provider layer registers commands automatically from plugin descriptors, the same way it already registers panels.

### Direct Command Matching Guidance

Choose matcher strictness deliberately.

- Use `createPrefixAliasMatcher` when aliases are already explicit commands.
- Use a custom matcher when a command should only be considered actionable if the trailing payload is valid.
- Prefer returning `matches: false` for invalid payloads instead of executing partially parsed input.

Example use cases for a custom matcher:

- `brightness 55`
- `wifi on`
- `power balanced`

Even when the matcher is strict, the suggestion layer may still surface the command for similar queries by alias/name similarity. This improves discoverability without making execution ambiguous.

### Launcher Behavior For Direct Commands

Direct commands intentionally behave like normal result items.

- They show icon, title, and action metadata in results.
- They can be navigated with arrow keys like apps and panel commands.
- They do not open an active panel session.
- `Enter` or click runs the command immediately.

This means direct commands should be designed with safe, explicit execution in mind.

Do not rely on side effects while the user is still typing.

### Capability And Backend Guidance For Direct Commands

- Declare only the capabilities the command truly needs.
- Reuse plugin-scoped backend access through `createPluginBackendSdk(...)` where possible.
- If the command triggers a Tauri backend action directly, keep capability enforcement through the shared command invocation layer.
- Reuse existing engine/parser logic instead of duplicating parsing inside the descriptor.

### Testing Requirements For Direct Commands

Required minimum coverage:

- matcher test
- plugin registration test
- launcher suggestion rendering test
- Apps injection test if `injectAsApp` is enabled
- execution-path test
- failure-path test for invalid or unsupported payloads

Recommended extra coverage:

- label derivation test when `getLabel` is dynamic
- priority ordering test when multiple commands match
- capability enforcement test when backend access is restricted

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

## Plugin Settings Injection Guide

Searchie supports plugin-defined settings that render automatically inside `src/components/settings/settings-panel.tsx`.

This is for internal/core plugins registered through the plugin registry. The plugin only defines keys and metadata. The settings UI and persistence are handled by shared infrastructure.

### What Plugin Authors Define

Define settings in your plugin descriptor with `defineCorePlugin` and `defineConfig`.

Supported value types:

- `boolean`
- `string`
- `number`
- `select` (`{ kind: "select", options: [...] }`)

Example:

```tsx
import { defineCorePlugin } from "@/plugins/sdk";

export const myPlugin = defineCorePlugin({
	id: "core.example",
	name: "Core Example",
	version: "0.1.0",
	permissions: [],
	panels: [],
	settings: (defineConfig) => [
		defineConfig("enabled", "boolean", false, {
			label: "Enabled",
			description: "Turn this feature on or off.",
			defaultValue: true,
		}),
		defineConfig("tagline", "string", true, {
			label: "Tagline",
			defaultValue: "",
		}),
		defineConfig("maxRetries", "number", true, {
			label: "Max Retries",
			defaultValue: 3,
		}),
		defineConfig(
			"mode",
			{
				kind: "select",
				options: [
					{ label: "Standard", value: "standard" },
					{ label: "Safe", value: "safe" },
				],
			},
			true,
			{
				label: "Mode",
				defaultValue: "standard",
			},
		),
	],
});
```

### How Persistence Works

- Plugin config definitions are validated and registered by `src/lib/plugin-registry.ts`.
- Values are stored through `src/lib/plugin-config-store.ts` using Tauri Store.
- Each plugin gets its own store file:
	- `plugin-config.<normalized-plugin-id>.json`
- Defaults are seeded automatically when missing.

### How UI Rendering Works

- `src/components/providers/panel-registry-provider.tsx` exposes plugin registry via `usePluginRegistry()`.
- `src/components/settings/settings-panel.tsx` reads `pluginRegistry.listPluginSettings()`.
- Controls are rendered automatically by value type:
	- `boolean` -> switch
	- `string` -> text input
	- `number` -> numeric input
	- `select` -> select dropdown

### SDK Access For Plugin Runtime

`src/plugins/sdk/backend.ts` provides `backend.config` helpers scoped to the current `pluginId`:

- `defineConfig(configKey, configValueType, optional?)`
- `listConfigDefinitions()`
- `getConfig(configKey)`
- `setConfig(configKey, value)`
- `listConfigValues()`

Use these when a panel needs to read/write plugin settings during runtime. Keep key declaration in plugin registration so settings remain discoverable and render correctly in the Settings panel.

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
- Direct command defined as `ShortcutCommandDescriptor` when the feature is one-shot.
- Registered through provider, not hardcoded in launcher.
- Uses `createPrefixAliasMatcher` or documented alternative matcher.
- Search mode (`immediate` vs `result-item`) intentionally chosen.
- Direct command matcher strictness intentionally chosen.
- Keyboard navigation complete and predictable.
- Focus transitions tested (input <-> list <-> actions).
- Shortcut hints shown and accurate.
- Async actions handle busy + error states.
- UI uses shadcn primitives and matches insignia interaction quality.
- Tests added and passing.

### Anti-Patterns To Avoid

- Adding panel-specific branching logic in `launcher-panel.tsx`.
- Adding direct-command-specific hardcoded branches for one plugin in `launcher-panel.tsx`.
- Calling raw Tauri `invoke(...)` inside panel features.
- Calling raw Tauri `invoke(...)` inside direct command descriptors when the shared backend/capability path already exists.
- Adding a second search input inside a panel when launcher input already exists.
- Repeating heavyweight shell wrappers (`rounded-xl border border-border/70 bg-card/92 shadow-lg`) across panel sections without a deliberate design reason.
- Hiding unavailable actions without feedback when user intent exists.
- Breaking keyboard flow by relying on mouse-only interactions.
- Returning huge unbounded result lists.
- Introducing aliases that overlap heavily with existing high-priority panels.
- Designing a direct command that executes automatically during fuzzy matching.

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
