import { ClipboardPanel } from "@/components/clipboard-panel";
import type { ShortcutPanelDescriptor } from "@/lib/panel-contract";
import { createPrefixAliasMatcher } from "@/lib/panel-matchers";

export const clipboardShortcutPanel: ShortcutPanelDescriptor = {
  id: "clipboard",
  name: "Clipboard",
  aliases: ["cl", "clipboard"],
  capabilities: ["clipboard.search", "clipboard.clear"],
  priority: 10,
  matcher: createPrefixAliasMatcher(["cl", "clipboard"]),
  component: ({ commandQuery }) => <ClipboardPanel commandQuery={commandQuery} />,
};
