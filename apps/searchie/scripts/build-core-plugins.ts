import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

type RuntimePluginManifest = {
  name: string;
  runtimeEntry: string;
  icon?: string;
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function requireRelativePath(label: string, value: string): string {
  const normalized = value.replace(/\\/g, "/").trim();
  if (!normalized.startsWith("./") || normalized.includes("..")) {
    throw new Error(`${label} must be a relative path that starts with './' and does not include '..': ${value}`);
  }

  return normalized;
}

async function exists(targetPath: string): Promise<boolean> {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function stagePlugin(pluginDir: string, outputRoot: string): Promise<void> {
  const manifestPath = path.join(pluginDir, "manifest.json");
  const manifestRaw = await readFile(manifestPath, "utf8");
  const manifest = JSON.parse(manifestRaw) as RuntimePluginManifest;

  if (!manifest.name?.trim()) {
    throw new Error(`Missing manifest name in ${manifestPath}`);
  }

  const runtimeEntry = requireRelativePath("runtimeEntry", manifest.runtimeEntry);
  const runtimeEntryAbsolute = path.join(pluginDir, runtimeEntry);
  if (!(await exists(runtimeEntryAbsolute))) {
    throw new Error(`Runtime entry not found for plugin ${manifest.name}: ${runtimeEntry}`);
  }

  const pluginId = slugify(manifest.name);
  if (!pluginId) {
    throw new Error(`Unable to derive plugin id from plugin name '${manifest.name}'`);
  }

  const stagedPluginDir = path.join(outputRoot, pluginId);
  await mkdir(stagedPluginDir, { recursive: true });

  await writeFile(path.join(stagedPluginDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await mkdir(path.dirname(path.join(stagedPluginDir, runtimeEntry)), { recursive: true });
  await cp(runtimeEntryAbsolute, path.join(stagedPluginDir, runtimeEntry), { recursive: false });

  if (manifest.icon) {
    const iconPath = requireRelativePath("icon", manifest.icon);
    const iconAbsolute = path.join(pluginDir, iconPath);
    if (await exists(iconAbsolute)) {
      await mkdir(path.dirname(path.join(stagedPluginDir, iconPath)), { recursive: true });
      await cp(iconAbsolute, path.join(stagedPluginDir, iconPath), { recursive: false });
    }
  }

  const assetsDir = path.join(pluginDir, "assets");
  if (await exists(assetsDir)) {
    await cp(assetsDir, path.join(stagedPluginDir, "assets"), { recursive: true });
  }

  process.stdout.write(`Staged core plugin '${manifest.name}' -> ${stagedPluginDir}\n`);
}

async function runBuildRuntime(pluginDir: string): Promise<void> {
  const result = spawnSync("bun", ["run", "build:runtime"], {
    cwd: pluginDir,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error(`build:runtime failed for ${pluginDir}`);
  }
}

async function run(): Promise<void> {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const appRoot = path.resolve(scriptDir, "..");
  const workspaceRoot = path.resolve(appRoot, "..", "..");
  const corePluginsRoot = path.join(workspaceRoot, "packages", "core-plugins");
  const outputRoot = path.join(appRoot, "src-tauri", "resources", "preinstalled-plugins");

  await mkdir(outputRoot, { recursive: true });
  const outputEntries = await readdir(outputRoot, { withFileTypes: true });
  for (const entry of outputEntries) {
    if (entry.name === ".gitkeep") {
      continue;
    }

    await rm(path.join(outputRoot, entry.name), { recursive: true, force: true });
  }

  const entries = await readdir(corePluginsRoot, { withFileTypes: true });
  const pluginDirs = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(corePluginsRoot, entry.name));

  for (const pluginDir of pluginDirs) {
    if (!(await exists(path.join(pluginDir, "manifest.json")))) {
      continue;
    }

    process.stdout.write(`Building core plugin runtime in ${pluginDir}\n`);
    await runBuildRuntime(pluginDir);
    await stagePlugin(pluginDir, outputRoot);
  }

  process.stdout.write(`Prepared preinstalled runtime plugins in ${outputRoot}\n`);
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Failed preparing core plugins: ${message}\n`);
  process.exit(1);
});
