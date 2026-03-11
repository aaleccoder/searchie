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
      (filePath) => !toNormalizedPath(filePath).includes("/panels/framework/"),
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
});
