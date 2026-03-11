import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const workspaceRoot = process.cwd();

function toNormalizedPath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

function collectTsxFiles(rootDir: string): string[] {
  const files: string[] = [];
  const entries = readdirSync(rootDir);

  for (const entry of entries) {
    const absolutePath = path.resolve(rootDir, entry);
    const stats = statSync(absolutePath);

    if (stats.isDirectory()) {
      files.push(...collectTsxFiles(absolutePath));
      continue;
    }

    if (entry.endsWith(".tsx")) {
      files.push(absolutePath);
    }
  }

  return files;
}

describe("panel import restrictions", () => {
  it("prevents panel implementations from importing raw ui components", () => {
    const panelFiles = collectTsxFiles(path.resolve(workspaceRoot, "src/components/panels")).filter(
      (filePath) => !toNormalizedPath(filePath).includes("/panels/framework/") && !toNormalizedPath(filePath).includes("/__tests__/"),
    );

    const extraPanelFiles = [path.resolve(workspaceRoot, "src/components/clipboard-panel.tsx")];
    const filesToCheck = [...panelFiles, ...extraPanelFiles];
    const offenders: string[] = [];

    for (const filePath of filesToCheck) {
      const content = readFileSync(filePath, "utf8");
      if (content.includes("@/components/ui/")) {
        offenders.push(path.relative(workspaceRoot, filePath));
      }
    }

    expect(offenders).toEqual([]);
  });

  it("requires plugin panels to import SDK and avoid raw invoke", () => {
    const corePanelFiles = collectTsxFiles(path.resolve(workspaceRoot, "src/components/panels")).filter(
      (filePath) => !toNormalizedPath(filePath).includes("/panels/framework/") && !toNormalizedPath(filePath).includes("/__tests__/"),
    );

    const panelFiles = [...corePanelFiles, path.resolve(workspaceRoot, "src/components/clipboard-panel.tsx")];
    const missingSdkImports: string[] = [];
    const rawInvokeOffenders: string[] = [];
    const rawCommandOffenders: string[] = [];

    for (const filePath of panelFiles) {
      const content = readFileSync(filePath, "utf8");
      if (!content.includes("@/plugins/sdk")) {
        missingSdkImports.push(path.relative(workspaceRoot, filePath));
      }

      if (content.includes("@tauri-apps/api/core")) {
        rawInvokeOffenders.push(path.relative(workspaceRoot, filePath));
      }

      if (content.includes("invokePanelCommand(") || content.includes("invokePanelCommand<")) {
        rawCommandOffenders.push(path.relative(workspaceRoot, filePath));
      }
    }

    expect(missingSdkImports).toEqual([]);
    expect(rawInvokeOffenders).toEqual([]);
    expect(rawCommandOffenders).toEqual([]);
  });

  it("prevents JSX intrinsic elements in plugin panel implementations", () => {
    const pluginPanelRoots = [
      path.resolve(workspaceRoot, "src/plugins/core"),
      path.resolve(workspaceRoot, "src/plugins/panels"),
    ];
    const panelFiles = pluginPanelRoots.flatMap((rootPath) => {
      try {
        return collectTsxFiles(rootPath).filter(
          (filePath) => !toNormalizedPath(filePath).includes("/__tests__/"),
        );
      } catch {
        return [];
      }
    });
    const intrinsicOffenders: string[] = [];

    for (const filePath of panelFiles) {
      const content = readFileSync(filePath, "utf8");
      if (/<\/?[a-z][a-z0-9-]*\b/.test(content)) {
        intrinsicOffenders.push(path.relative(workspaceRoot, filePath));
      }
    }

    expect(intrinsicOffenders).toEqual([]);
  });
});
