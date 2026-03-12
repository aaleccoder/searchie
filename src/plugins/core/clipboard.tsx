import type { CorePluginDescriptor } from "@/lib/plugin-contract";
import { clipboardShortcutPanel } from "./internal/clipboard/descriptor";

export function createCoreClipboardPlugin(): CorePluginDescriptor {
  return {
    id: "core.clipboard",
    name: "Core Clipboard",
    version: "0.1.0",
    permissions: ["clipboard.search", "clipboard.clear", "clipboard.pin", "clipboard.delete"],
    panels: [clipboardShortcutPanel],
  };
}
