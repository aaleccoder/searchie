export { buildSettingsSearchPanels } from "./descriptors";
export { SETTINGS_SEARCH_ALIAS_LIST } from "./aliases";
export {
  extractSettingsAliasQuery,
  normalizeSettingsCatalog,
  scoreSettingsMatch,
  searchSettingsEntries,
  type SettingsSearchEntry,
} from "./lib/settings-search-engine";
export { loadSettingsCatalog } from "./lib/settings-search-catalog";
