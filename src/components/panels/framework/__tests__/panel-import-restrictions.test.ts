import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
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
  function collectPluginPanelFiles(): string[] {
    const roots = [
      path.resolve(workspaceRoot, "src/plugins/core/panels"),
      path.resolve(workspaceRoot, "src/plugins/panels"),
    ];

    return roots.flatMap((rootPath) => {
      try {
        return collectTsxFiles(rootPath).filter(
          (filePath) => !toNormalizedPath(filePath).includes("/__tests__/"),
        );
      } catch {
        return [];
      }
    });
  }

  it("prevents plugin panel implementations from importing raw ui components", () => {
    const filesToCheck = collectPluginPanelFiles();
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
    const panelFiles = collectPluginPanelFiles();
    const missingSdkImports: string[] = [];
    const rawInvokeOffenders: string[] = [];
    const rawCommandOffenders: string[] = [];

    for (const filePath of panelFiles) {
      const content = readFileSync(filePath, "utf8");
      if (!(content.includes("@/plugins/sdk") || content.includes("@/plugins/core/internal/"))) {
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
    const panelFiles = collectPluginPanelFiles();
    const intrinsicOffenders: string[] = [];

    for (const filePath of panelFiles) {
      const content = readFileSync(filePath, "utf8");
      const source = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      let hasIntrinsic = false;

      const visit = (node: ts.Node) => {
        if (hasIntrinsic) {
          return;
        }

        if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
          const tagName = node.tagName.getText(source);
          if (/^[a-z]/.test(tagName)) {
            hasIntrinsic = true;
            return;
          }
        }

        ts.forEachChild(node, visit);
      };

      visit(source);

      if (hasIntrinsic) {
        intrinsicOffenders.push(path.relative(workspaceRoot, filePath));
      }
    }

    expect(intrinsicOffenders).toEqual([]);
  });
});
