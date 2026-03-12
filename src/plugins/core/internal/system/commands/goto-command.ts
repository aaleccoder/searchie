import { Globe } from "lucide-react";
import type { ShortcutCommandDescriptor } from "@/lib/panel-contract";
import { createPrefixAliasMatcher } from "@/lib/panel-matchers";
import { createPluginBackendSdk, definePluginCommand } from "@/plugins/sdk";
import type { PanelCommandScope } from "@/lib/tauri-commands";

const gotoCommandScope: PanelCommandScope = {
  pluginId: "core.system",
  id: "system-goto",
  capabilities: ["window.shell"],
};

const gotoBackend = createPluginBackendSdk(gotoCommandScope);

const GOTO_ALIASES = ["goto", "go to"];

function normalizeGotoTarget(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  if (/^[a-z][a-z\d+.-]*:/i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

function createGotoMatcher(): ShortcutCommandDescriptor["matcher"] {
  const matcher = createPrefixAliasMatcher(GOTO_ALIASES);
  return (query) => {
    const match = matcher(query);
    if (!match.matches) {
      return match;
    }

    return normalizeGotoTarget(match.commandQuery)
      ? match
      : { matches: false, commandQuery: "" };
  };
}

export const gotoCommand: ShortcutCommandDescriptor = definePluginCommand({
  id: "system-goto",
  name: "Go To",
  aliases: GOTO_ALIASES,
  commandIcon: Globe,
  capabilities: ["window.shell"],
  priority: 42,
  appsLauncherIntegration: {
    injectAsApp: true,
  },
  matcher: createGotoMatcher(),
  getLabel: ({ commandQuery }) => {
    const target = normalizeGotoTarget(commandQuery);
    return target ? `Open ${target}` : "Open website";
  },
  execute: async ({ commandQuery }) => {
    const target = normalizeGotoTarget(commandQuery);
    if (!target) {
      return;
    }

    await gotoBackend.window.openUrl(target);
  },
});
