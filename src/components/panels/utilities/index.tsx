import type { ShortcutPanelDescriptor } from "@/lib/panel-contract";
import { createPrefixAliasMatcher } from "@/lib/panel-matchers";
import { CalcUtilityPanel } from "@/components/panels/utilities/calc-utility-panel";
import { ConversionUtilityPanel } from "@/components/panels/utilities/conversion-utility-panel";
import { CALC_ALIASES, CONVERSION_ALIASES, flattenAliases } from "@/components/panels/utilities/aliases";

function createCalcPanel(): ShortcutPanelDescriptor {
  const aliases = flattenAliases(CALC_ALIASES);
  return {
    id: "utilities-calc",
    name: "Calculator",
    aliases,
    capabilities: [],
    priority: 25,
    searchIntegration: {
      activationMode: "immediate",
      placeholder: "Search calculator...",
      exitOnEscape: true,
    },
    matcher: createPrefixAliasMatcher(aliases),
    component: ({ commandQuery }) => <CalcUtilityPanel commandQuery={commandQuery} />,
  };
}

function createConversionPanel(): ShortcutPanelDescriptor {
  const aliases = flattenAliases(CONVERSION_ALIASES);
  return {
    id: "utilities-convert",
    name: "Converter",
    aliases,
    capabilities: [],
    priority: 24,
    searchIntegration: {
      activationMode: "immediate",
      placeholder: "Search converter...",
      exitOnEscape: true,
    },
    matcher: createPrefixAliasMatcher(aliases),
    component: ({ commandQuery }) => <ConversionUtilityPanel commandQuery={commandQuery} />,
  };
}

export function buildUtilityPanels(): ShortcutPanelDescriptor[] {
  return [createCalcPanel(), createConversionPanel()];
}
