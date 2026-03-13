#!/usr/bin/env node
import { build, type PluginBuild } from "esbuild";
import JSZip from "jszip";
import fs from "node:fs/promises";
import path from "node:path";
import { validateManifest, type PluginManifest, type PluginManifestCommand } from "./manifest-schema";

type CliContext = {
  pluginDir: string;
  manifestPath: string;
};

type CommandName = "build" | "pack" | "create";

const SDK_EXPORTS = [
  "PanelArticle",
  "PanelAside",
  "PanelCode",
  "PanelContainer",
  "PanelFigureImage",
  "PanelFlex",
  "PanelGrid",
  "PanelHeading",
  "PanelInline",
  "PanelList",
  "PanelListItem",
  "PanelMetaGrid",
  "PanelParagraph",
  "PanelPre",
  "PanelSection",
  "PanelText",
  "PanelTextButton",
  "Badge",
  "Button",
  "Empty",
  "EmptyDescription",
  "EmptyHeader",
  "EmptyMedia",
  "EmptyTitle",
  "Grid",
  "Input",
  "Kbd",
  "KbdGroup",
  "List",
  "ListItem",
  "MetaGrid",
  "ScrollArea",
  "Select",
  "SelectContent",
  "SelectItem",
  "SelectTrigger",
  "SelectValue",
  "Slider",
  "Tooltip",
  "TooltipContent",
  "TooltipProvider",
  "TooltipTrigger",
  "createPluginBackendSdk",
  "defineCorePlugin",
  "definePluginCommand",
  "definePluginPanel",
] as const;

function parsePluginContext(argv: string[]): CliContext {
  let pluginDir = process.cwd();

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--plugin" || arg === "-p") {
      const next = argv[i + 1];
      if (!next) {
        throw new Error("Missing value for --plugin");
      }
      pluginDir = path.resolve(next);
      i += 1;
    }
  }

  return {
    pluginDir,
    manifestPath: path.join(pluginDir, "manifest.json"),
  };
}

function hasFlag(argv: string[], ...flagNames: string[]): boolean {
  return argv.some((arg) => flagNames.includes(arg));
}

function getOptionValue(argv: string[], names: string[]): string | undefined {
  for (let index = 0; index < argv.length; index += 1) {
    if (names.includes(argv[index])) {
      return argv[index + 1];
    }
  }

  return undefined;
}

function normalizeAliasList(command: PluginManifestCommand): string[] {
  const aliases = (command.aliases ?? []).map((alias) => alias.trim()).filter(Boolean);
  if (aliases.length > 0) {
    return aliases;
  }

  const name = command.name.trim().toLowerCase();
  return name ? [name] : [];
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function makeRuntimeWrapperCode(manifest: PluginManifest, panelCommands: PluginManifestCommand[]): string {
  const imports = panelCommands
    .map((command, index) => `import PanelCommand${index} from ${JSON.stringify(command.entry)};`)
    .join("\n");

  const panelsJson = JSON.stringify(
    panelCommands.map((command, index) => ({
      index,
      id: command.id,
      name: command.name,
      aliases: normalizeAliasList(command),
      capabilities: command.capabilities ?? [],
      searchIntegration: command.searchIntegration,
      shortcuts: command.shortcuts,
    })),
  );

  const pluginId = slugify(manifest.name) || "runtime-plugin";
  const pluginName = manifest.title?.trim() || manifest.name;

  return `${imports}

const __panels = ${panelsJson};
const __pluginId = ${JSON.stringify(pluginId)};
const __pluginName = ${JSON.stringify(pluginName)};

globalThis.__searchieRuntimePluginFactory = function(runtimeApi) {
  const React = runtimeApi.React;
  const panelComponents = [${panelCommands.map((_, index) => `PanelCommand${index}`).join(", ")}];

  return {
    id: "runtime." + __pluginId,
    name: __pluginName,
    version: "0.1.0",
    permissions: Array.from(new Set(__panels.flatMap(function(panel) { return panel.capabilities || []; }))),
    panels: __panels.map(function(panel) {
      const component = panelComponents[panel.index];
      return {
        id: panel.id,
        name: panel.name,
        aliases: panel.aliases,
        capabilities: panel.capabilities || [],
        matcher: runtimeApi.createPrefixAliasMatcher(panel.aliases),
        searchIntegration: panel.searchIntegration,
        shortcuts: panel.shortcuts,
        component: function RuntimePanelComponent(props) {
          return React.createElement(component, props);
        },
      };
    }),
  };
};
`;
}

async function readManifest(manifestPath: string): Promise<PluginManifest> {
  const text = await fs.readFile(manifestPath, "utf8");
  return validateManifest(JSON.parse(text));
}

function getPanelCommands(manifest: PluginManifest): PluginManifestCommand[] {
  return manifest.commands.filter((command) => command.mode === "panel");
}

function sdkShimSource(): string {
  const exportLines = SDK_EXPORTS.map((name) => `export const ${name} = __sdk.${name};`).join("\n");

  return `const __sdk = globalThis.__searchieRuntimeApi.sdk;\n${exportLines}\n`;
}

function reactShimSource(): string {
  return `const React = globalThis.__searchieRuntimeApi.React;
export default React;
export const createElement = React.createElement;
export const Fragment = React.Fragment;
export const useState = React.useState;
export const useMemo = React.useMemo;
export const useEffect = React.useEffect;
export const useRef = React.useRef;
export const useCallback = React.useCallback;
export const useLayoutEffect = React.useLayoutEffect;
export const useReducer = React.useReducer;
export const useContext = React.useContext;
export const forwardRef = React.forwardRef;
`;
}

function reactJsxRuntimeShimSource(): string {
  return `const React = globalThis.__searchieRuntimeApi.React;
export const Fragment = React.Fragment;
export function jsx(type, props, key) {
  if (typeof key !== "undefined") {
    return React.createElement(type, { ...props, key });
  }
  return React.createElement(type, props);
}
export const jsxs = jsx;
export const jsxDEV = jsx;
`;
}

async function buildRuntimeEntry(context: CliContext): Promise<PluginManifest> {
  const manifest = await readManifest(context.manifestPath);
  const panelCommands = getPanelCommands(manifest);

  if (panelCommands.length === 0) {
    throw new Error("No panel commands with an entry were found in manifest.json.");
  }

  const runtimeEntry = manifest.runtimeEntry;
  const runtimeOutFile = path.resolve(context.pluginDir, runtimeEntry);

  await fs.mkdir(path.dirname(runtimeOutFile), { recursive: true });

  const wrapperCode = makeRuntimeWrapperCode(manifest, panelCommands);

  await build({
    stdin: {
      contents: wrapperCode,
      resolveDir: context.pluginDir,
      sourcefile: "runtime-wrapper.ts",
      loader: "ts",
    },
    outfile: runtimeOutFile,
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["es2020"],
    jsx: "transform",
    jsxFactory: "React.createElement",
    jsxFragment: "React.Fragment",
    plugins: [
      {
        name: "searchie-runtime-shims",
        setup(buildApi: PluginBuild) {
          buildApi.onResolve({ filter: /^sdk$/ }, () => ({ path: "sdk", namespace: "searchie-shim" }));
          buildApi.onResolve({ filter: /^react$/ }, () => ({ path: "react", namespace: "searchie-shim" }));
          buildApi.onResolve({ filter: /^react\/jsx-runtime$/ }, () => ({
            path: "react/jsx-runtime",
            namespace: "searchie-shim",
          }));
          buildApi.onResolve({ filter: /^react\/jsx-dev-runtime$/ }, () => ({
            path: "react/jsx-dev-runtime",
            namespace: "searchie-shim",
          }));

          buildApi.onLoad({ filter: /^sdk$/, namespace: "searchie-shim" }, () => ({
            contents: sdkShimSource(),
            loader: "js",
          }));

          buildApi.onLoad({ filter: /^react$/, namespace: "searchie-shim" }, () => ({
            contents: reactShimSource(),
            loader: "js",
          }));

          buildApi.onLoad({ filter: /^react\/jsx-runtime$/, namespace: "searchie-shim" }, () => ({
            contents: reactJsxRuntimeShimSource(),
            loader: "js",
          }));

          buildApi.onLoad({ filter: /^react\/jsx-dev-runtime$/, namespace: "searchie-shim" }, () => ({
            contents: reactJsxRuntimeShimSource(),
            loader: "js",
          }));
        },
      },
    ],
  });

  const manifestNext: PluginManifest = {
    ...manifest,
    runtimeEntry,
  };

  await fs.writeFile(context.manifestPath, `${JSON.stringify(manifestNext, null, 2)}\n`, "utf8");

  process.stdout.write(`Built runtime plugin entry: ${runtimeOutFile}\n`);
  return manifestNext;
}

async function addPathToZip(zip: JSZip, baseDir: string, relativePath: string): Promise<void> {
  const absolutePath = path.resolve(baseDir, relativePath);
  const stat = await fs.stat(absolutePath);

  if (stat.isDirectory()) {
    const entries = await fs.readdir(absolutePath, { withFileTypes: true });
    for (const entry of entries) {
      const childRelativePath = path.join(relativePath, entry.name).replace(/\\/g, "/");
      if (entry.isDirectory()) {
        await addPathToZip(zip, baseDir, childRelativePath);
      } else if (entry.isFile()) {
        const content = await fs.readFile(path.resolve(baseDir, childRelativePath));
        zip.file(childRelativePath, content);
      }
    }
    return;
  }

  const content = await fs.readFile(absolutePath);
  zip.file(relativePath.replace(/\\/g, "/"), content);
}

async function packPlugin(context: CliContext, argv: string[]): Promise<void> {
  const shouldBuild = !hasFlag(argv, "--skip-build");
  const outputOption = getOptionValue(argv, ["--out", "-o"]);

  const manifest = shouldBuild ? await buildRuntimeEntry(context) : await readManifest(context.manifestPath);
  const runtimeEntryAbsolutePath = path.resolve(context.pluginDir, manifest.runtimeEntry);

  try {
    const runtimeStat = await fs.stat(runtimeEntryAbsolutePath);
    if (!runtimeStat.isFile()) {
      throw new Error();
    }
  } catch {
    throw new Error(`runtime entry not found: ${manifest.runtimeEntry}. Run 'searchie-plugin build' first.`);
  }

  const outputFileName = outputOption?.trim() || `${manifest.name}.runtime.zip`;
  const outputAbsolutePath = path.resolve(context.pluginDir, outputFileName);

  const zip = new JSZip();
  await addPathToZip(zip, context.pluginDir, "manifest.json");
  await addPathToZip(zip, context.pluginDir, manifest.runtimeEntry);

  if (manifest.icon) {
    await addPathToZip(zip, context.pluginDir, manifest.icon);
  }

  const assetsPath = path.resolve(context.pluginDir, "assets");
  try {
    const assetsStat = await fs.stat(assetsPath);
    if (assetsStat.isDirectory()) {
      await addPathToZip(zip, context.pluginDir, "assets");
    }
  } catch {
    // optional assets directory
  }

  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  await fs.writeFile(outputAbsolutePath, buffer);

  process.stdout.write(`Packed runtime plugin: ${outputAbsolutePath}\n`);
}

function toSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function toTitle(value: string): string {
  return value
    .split(/[\s-_]+/g)
    .filter(Boolean)
    .map((segment) => segment[0].toUpperCase() + segment.slice(1).toLowerCase())
    .join(" ");
}

async function createPlugin(argv: string[]): Promise<void> {
  const explicitName = getOptionValue(argv, ["--name", "-n"]);
  const firstPositional = argv.find((arg) => !arg.startsWith("-"));
  const inputName = (explicitName ?? firstPositional ?? "").trim();

  if (!inputName) {
    throw new Error("Missing plugin name. Usage: searchie-plugin create <plugin-name> [--dir <path>]");
  }

  const slug = toSlug(inputName);
  if (!slug) {
    throw new Error("Plugin name must include letters or numbers.");
  }

  const outputRoot = path.resolve(getOptionValue(argv, ["--dir", "-d"]) ?? process.cwd());
  const pluginDir = path.join(outputRoot, slug);
  const force = hasFlag(argv, "--force", "-f");
  let exists = false;
  try {
    await fs.stat(pluginDir);
    exists = true;
  } catch {
    exists = false;
  }

  if (exists && !force) {
    throw new Error(`Directory already exists: ${pluginDir}. Use --force to overwrite.`);
  }

  await fs.mkdir(path.join(pluginDir, "src"), { recursive: true });
  await fs.mkdir(path.join(pluginDir, "assets"), { recursive: true });

  const title = toTitle(inputName);
  const commandAlias = slug.replace(/-/g, " ");

  const manifest: PluginManifest = validateManifest({
    name: slug,
    title,
    description: `${title} plugin for Searchie.`,
    version: "0.1.0",
    runtimeEntry: "./dist/runtime.js",
    commands: [
      {
        id: `${slug}.panel`,
        name: commandAlias,
        mode: "panel",
        entry: "./src/command.tsx",
        aliases: [commandAlias],
        capabilities: [],
      },
    ],
  });

  const pluginPackageJson = {
    name: `@searchie-plugin/${slug}`,
    version: "0.1.0",
    private: true,
    type: "module",
    scripts: {
      "build:runtime": "searchie-plugin build",
      pack: "searchie-plugin pack",
      typecheck: "tsc --noEmit",
    },
    dependencies: {
      react: "^19.1.1",
      "@searchie/sdk": "latest",
    },
    devDependencies: {
      typescript: "^5.8.3",
      "@types/react": "^19.1.12",
    },
  };

  const tsconfig = {
    compilerOptions: {
      target: "ES2022",
      module: "ESNext",
      moduleResolution: "Bundler",
      jsx: "react-jsx",
      strict: true,
      noEmit: true,
      skipLibCheck: true,
    },
    include: ["src/**/*.ts", "src/**/*.tsx"],
  };

  const commandTemplate = `import React from "react";
import { PanelContainer, PanelHeading, PanelParagraph } from "sdk";

export default function ${title.replace(/\s+/g, "")}Panel(): JSX.Element {
  return (
    <PanelContainer>
      <PanelHeading>${title}</PanelHeading>
      <PanelParagraph>Edit src/command.tsx to build your panel.</PanelParagraph>
    </PanelContainer>
  );
}
`;

  const runtimeShimTypes = `declare module "sdk" {
  export * from "@searchie/sdk";
}
`;

  const readme = `# ${title}

## Development

1. Install dependencies.
2. Run \`npm run build:runtime\` to generate \`dist/runtime.js\`.
3. Run \`npm run pack\` to generate the installable plugin zip.
`;

  await fs.writeFile(path.join(pluginDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await fs.writeFile(path.join(pluginDir, "package.json"), `${JSON.stringify(pluginPackageJson, null, 2)}\n`, "utf8");
  await fs.writeFile(path.join(pluginDir, "tsconfig.json"), `${JSON.stringify(tsconfig, null, 2)}\n`, "utf8");
  await fs.writeFile(path.join(pluginDir, "src", "command.tsx"), commandTemplate, "utf8");
  await fs.writeFile(path.join(pluginDir, "src", "runtime-shims.d.ts"), runtimeShimTypes, "utf8");
  await fs.writeFile(path.join(pluginDir, "README.md"), readme, "utf8");

  process.stdout.write(`Created plugin scaffold: ${pluginDir}\n`);
}

async function main(): Promise<void> {
  const commandArg = (process.argv[2] ?? "build").trim().toLowerCase() as CommandName;
  const supportedCommands: CommandName[] = ["build", "pack", "create"];
  if (!supportedCommands.includes(commandArg)) {
    throw new Error(`Unknown command '${commandArg}'. Supported: ${supportedCommands.join(", ")}`);
  }

  const commandArgs = process.argv.slice(3);

  if (commandArg === "create") {
    await createPlugin(commandArgs);
    return;
  }

  const context = parsePluginContext(commandArgs);

  if (commandArg === "build") {
    await buildRuntimeEntry(context);
    return;
  }

  await packPlugin(context, commandArgs);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
