# @searchie/plugin-cli

TypeScript-first CLI for Searchie runtime plugins.

## Commands

- `searchie-plugin create <plugin-name> [--dir <output-dir>] [--force]`
- `searchie-plugin build [--plugin <path-to-plugin-dir>]`
- `searchie-plugin pack [--plugin <path-to-plugin-dir>] [--out <zip-file>] [--skip-build]`

## What Each Command Does

- `create`: scaffolds a new plugin project (`manifest.json`, `src/command.tsx`, `package.json`, `tsconfig.json`)
- `build`: compiles TS/TSX panel entries into `runtimeEntry` (defaults to `./dist/runtime.js`)
- `pack`: creates installable zip including `manifest.json`, runtime entry, optional icon, and optional `assets/`

## Manifest Schema (Enforced)

`build` and `pack` both validate `manifest.json` before doing anything:

- required: `name`, `commands`, `runtimeEntry`
- commands must have: `id`, `name`, `mode` (`panel`), `entry`, `aliases`, `capabilities`
- file paths (`entry`, `runtimeEntry`, `icon`) must be relative (`./...`) and cannot contain `..`
- `capabilities` must use supported Searchie capability strings
- duplicate command ids are rejected

## Authoring Notes

- In runtime panel code, import SDK APIs from `@searchie/sdk`.
- `searchie-plugin build` remaps `@searchie/sdk` imports to the host runtime SDK at bundle-time.

## Example Manifest

```json
{
  "name": "my-plugin",
  "title": "My Plugin",
  "runtimeEntry": "./dist/runtime.js",
  "commands": [
    {
      "id": "my-plugin.panel",
      "name": "my plugin",
      "mode": "panel",
      "entry": "./src/command.tsx",
      "aliases": ["my plugin"],
      "capabilities": []
    }
  ]
}
```
