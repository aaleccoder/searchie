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
  matcher: createPrefixAliasMatcher(["cl", "clip", "clipboard"]),
  component: ({ commandQuery, registerInputArrowDownHandler, focusLauncherInput }) => (
    <ClipboardPanel
      commandQuery={commandQuery}
      registerInputArrowDownHandler={registerInputArrowDownHandler}
      focusLauncherInput={focusLauncherInput}
    />
  ),
};
