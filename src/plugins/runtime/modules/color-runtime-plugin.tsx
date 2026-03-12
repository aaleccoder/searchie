import manifestJson from "@/plugins/core/internal/utilities/features/color/manifest.json";
import { COLOR_ALIASES, flattenAliases } from "@/plugins/core/internal/utilities/aliases";
import { createPrefixAliasMatcher } from "@/lib/panel-matchers";
import { defineCorePlugin, definePluginPanel } from "@/plugins/sdk";
import { ColorUtilityPanel } from "@/plugins/core/internal/utilities/features/color/color-utility-panel";

export const manifest = manifestJson;

export function createRuntimePlugin() {
  const aliases = flattenAliases(COLOR_ALIASES);

  return defineCorePlugin({
    id: "runtime.color",
    name: "Runtime Color Plugin",
    version: "0.1.0",
    permissions: [],
    panels: [
      definePluginPanel({
        id: manifest.id,
        name: manifest.name,
        aliases,
        capabilities: [],
        priority: 21,
        searchIntegration: {
          activationMode: "immediate",
          placeholder: "Search color values...",
          exitOnEscape: true,
        },
        shortcuts: [
          { keys: "Enter", description: "Apply conversion" },
          { keys: "Escape", description: "Back to launcher commands" },
        ],
        matcher: createPrefixAliasMatcher(aliases),
        component: ({ commandQuery }) => <ColorUtilityPanel commandQuery={commandQuery} />,
      }),
    ],
  });
}
