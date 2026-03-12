import { normalizeSettingsCatalog, type SettingsSearchEntry } from "./settings-search-engine";

const SETTINGS_CATALOG_URL = "/settings.json";

let cachedCatalog: SettingsSearchEntry[] | null = null;
let pendingCatalog: Promise<SettingsSearchEntry[]> | null = null;

export function resetSettingsCatalogCacheForTests(): void {
  cachedCatalog = null;
  pendingCatalog = null;
}

export async function loadSettingsCatalog(): Promise<SettingsSearchEntry[]> {
  if (cachedCatalog) {
    return cachedCatalog;
  }

  if (pendingCatalog) {
    return pendingCatalog;
  }

  pendingCatalog = fetch(SETTINGS_CATALOG_URL)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Failed to load settings catalog: ${response.status}`);
      }

      const payload = await response.json();
      const normalized = normalizeSettingsCatalog(payload);
      cachedCatalog = normalized;
      return normalized;
    })
    .catch((error) => {
      console.error("[settings-search] failed to load settings catalog", error);
      return [];
    })
    .finally(() => {
      pendingCatalog = null;
    });

  return pendingCatalog;
}
