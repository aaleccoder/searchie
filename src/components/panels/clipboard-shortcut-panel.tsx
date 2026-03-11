import { ClipboardPanel } from "@/components/clipboard-panel";
import type { ShortcutPanelDescriptor } from "@/lib/panel-contract";
import { createPrefixAliasMatcher } from "@/lib/panel-matchers";

export const clipboardShortcutPanel: ShortcutPanelDescriptor = {
  id: "clipboard",
  name: "Clipboard",
  aliases: ["cl", "clipboard"],
  capabilities: ["clipboard.search", "clipboard.clear"],
  priority: 10,
  searchIntegration: {
    activateOnEnter: true,
    placeholder: "Search clipboard history...",
    exitOnEscape: true,
  },
  matcher: createPrefixAliasMatcher(["cl", "clipboard"]),
  component: ({ commandQuery, registerInputArrowDownHandler, focusLauncherInput }) => (
    <ClipboardPanel
      commandQuery={commandQuery}
      registerInputArrowDownHandler={registerInputArrowDownHandler}
      focusLauncherInput={focusLauncherInput}
    />
  ),
};
