import { ClipboardPanel } from "@/components/clipboard-panel";
import { Clipboard } from "lucide-react";
import type { ShortcutPanelDescriptor } from "@/lib/panel-contract";
import { createPrefixAliasMatcher } from "@/lib/panel-matchers";

export const clipboardShortcutPanel: ShortcutPanelDescriptor = {
  id: "clipboard",
  name: "Clipboard",
  aliases: ["cl", "clip", "clipboard"],
  commandIcon: Clipboard,
  capabilities: ["clipboard.search", "clipboard.clear", "clipboard.pin", "clipboard.delete"],
  priority: 10,
  searchIntegration: {
    activationMode: "result-item",
    placeholder: "Search clipboard history...",
    exitOnEscape: true,
  },
  shortcuts: [
    { keys: "Enter", description: "Copy selected item" },
    { keys: "Mod+O", description: "Open link(s) from selected item" },
    { keys: "Mod+Shift+P", description: "Pin or unpin selected item" },
    { keys: "Mod+P", description: "Cycle filter" },
    { keys: "Control+X", description: "Delete selected item" },
    { keys: "Control+Shift+X", description: "Clear all history" },
  ],
  matcher: createPrefixAliasMatcher(["cl", "clip", "clipboard"]),
  component: ({ commandQuery, registerInputArrowDownHandler, focusLauncherInput, clearLauncherInput }) => (
    <ClipboardPanel
      commandQuery={commandQuery}
      registerInputArrowDownHandler={registerInputArrowDownHandler}
      focusLauncherInput={focusLauncherInput}
      clearLauncherInput={clearLauncherInput}
    />
  ),
};
