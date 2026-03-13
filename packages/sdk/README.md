# sdk

`packages/sdk` is the shared plugin-facing contract layer for Searchie.

## What belongs here

- Backend command contracts and capability-checked command helpers.
- Headless panel primitives (layout, text, list, virtualization behavior).
- Type exports used by plugin authors.

## What does not belong here

- App-specific shadcn component bindings (`Badge`, `Button`, `Select`, etc.).
- App utility aliases like `@/components/*` or `@/lib/*`.

Those concrete UI bindings stay in `apps/searchie/src/components/framework/panel-primitives.tsx`, which acts as the app adapter.
