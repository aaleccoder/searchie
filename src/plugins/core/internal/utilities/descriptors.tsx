import { FolderSearch, SmilePlus } from "lucide-react";
import { definePluginPanel } from "@/plugins/sdk";
import type { ShortcutPanelDescriptor } from "@/lib/panel-contract";
import { createPrefixAliasMatcher } from "@/lib/panel-matchers";
import {
  CALC_ALIASES,
  CONVERSION_ALIASES,
  FILE_SEARCH_ALIASES,
  GLYPH_PICKER_ALIASES,
  flattenAliases,
} from "@/plugins/core/internal/utilities/aliases";
import { CalcUtilityPanel } from "./calc-utility-panel";
import { ConversionUtilityPanel } from "./conversion-utility-panel";
import { onFileSearchInputKeyDown } from "./file-search-keybindings";
import { FileSearchUtilityPanel } from "../system/file-search-utility-panel";
import { onGlyphPickerInputKeyDown } from "./glyph-picker-keybindings";
import { GlyphPickerUtilityPanel } from "./glyph-picker-utility-panel";

function createCalcPanel(): ShortcutPanelDescriptor {
  const aliases = flattenAliases(CALC_ALIASES);
  return definePluginPanel({
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
    shortcuts: [
      { keys: "Enter", description: "Evaluate input expression" },
      { keys: "Escape", description: "Back to launcher commands" },
    ],
    matcher: createPrefixAliasMatcher(aliases),
    component: ({ commandQuery }) => <CalcUtilityPanel commandQuery={commandQuery} />,
  });
}

function createConversionPanel(): ShortcutPanelDescriptor {
  const aliases = flattenAliases(CONVERSION_ALIASES);
  return definePluginPanel({
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
    shortcuts: [
      { keys: "Enter", description: "Apply current conversion" },
      { keys: "Escape", description: "Back to launcher commands" },
    ],
    matcher: createPrefixAliasMatcher(aliases),
    component: ({ commandQuery }) => <ConversionUtilityPanel commandQuery={commandQuery} />,
  });
}

function createFileSearchPanel(): ShortcutPanelDescriptor {
  const aliases = flattenAliases(FILE_SEARCH_ALIASES);
  return definePluginPanel({
    id: "utilities-file-search",
    name: "File Search",
    aliases,
    capabilities: ["files.search", "files.open"],
    commandIcon: FolderSearch,
    priority: 26,
    searchIntegration: {
      activationMode: "immediate",
      placeholder: "Search files...",
      exitOnEscape: true,
    },
    shortcuts: [
      { keys: "ArrowUp/ArrowDown", description: "Move result selection" },
      { keys: "ArrowRight", description: "Focus action buttons" },
      { keys: "Enter", description: "Open file" },
      { keys: "Shift+Enter", description: "Reveal file in explorer" },
    ],
    matcher: createPrefixAliasMatcher(aliases),
    onInputKeyDown: onFileSearchInputKeyDown,
    component: ({ commandQuery, registerInputArrowDownHandler, focusLauncherInput }) => (
      <FileSearchUtilityPanel
        commandQuery={commandQuery}
        registerInputArrowDownHandler={registerInputArrowDownHandler}
        focusLauncherInput={focusLauncherInput}
      />
    ),
  });
}

function createGlyphPickerPanel(): ShortcutPanelDescriptor {
  const aliases = flattenAliases(GLYPH_PICKER_ALIASES);
  return definePluginPanel({
    id: "utilities-glyph-picker",
    name: "Glyph Picker",
    aliases,
    capabilities: [],
    commandIcon: SmilePlus,
    priority: 23,
    searchIntegration: {
      activationMode: "immediate",
      placeholder: "Search emoji, emoticons, and symbols...",
      exitOnEscape: true,
    },
    shortcuts: [
      { keys: "ArrowUp/ArrowDown", description: "Move glyph selection" },
      { keys: "ArrowRight", description: "Focus actions" },
      { keys: "ArrowLeft", description: "Back to list/input" },
      { keys: "Enter", description: "Copy selected glyph" },
      { keys: "Escape", description: "Back to launcher commands" },
    ],
    matcher: createPrefixAliasMatcher(aliases),
    onInputKeyDown: onGlyphPickerInputKeyDown,
    component: ({
      commandQuery,
      registerInputArrowDownHandler,
      registerInputEnterHandler,
      registerPanelFooter,
      focusLauncherInput,
    }) => (
      <GlyphPickerUtilityPanel
        commandQuery={commandQuery}
        registerInputArrowDownHandler={registerInputArrowDownHandler}
        registerInputEnterHandler={registerInputEnterHandler}
        registerPanelFooter={registerPanelFooter}
        focusLauncherInput={focusLauncherInput}
      />
    ),
  });
}

export function buildUtilityPanels(): ShortcutPanelDescriptor[] {
  return [createFileSearchPanel(), createCalcPanel(), createConversionPanel(), createGlyphPickerPanel()];
}
