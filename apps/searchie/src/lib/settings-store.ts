import { create } from "zustand";
import { load } from "@tauri-apps/plugin-store";
import { invoke } from "@tauri-apps/api/core";
import { defaultSettings, Settings, settingsSchema } from "@/lib/settings-schema";

const STORE_FILE = "settings.json";
const STORE_KEY = "settings";

interface SettingsState {
  settings: Settings;
  loading: boolean;
  init: () => Promise<void>;
  updateSettings: (updates: Partial<Settings>) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: defaultSettings,
  loading: true,

  init: async () => {
    try {
      const store = await load(STORE_FILE);
      const raw = await store.get<Settings>(STORE_KEY);
      if (raw) {
        const parsed = settingsSchema.safeParse(raw);
        if (parsed.success) {
          set({ settings: parsed.data });
        }
      }
    } catch (e) {
      console.error("[settings] Failed to load:", e);
    } finally {
      set({ loading: false });
    }
  },

  updateSettings: async (updates) => {
    const prev = get().settings;
    const next = { ...prev, ...updates };
    set({ settings: next });

    try {
      const store = await load(STORE_FILE);
      await store.set(STORE_KEY, next);
      await store.save();

      // Re-register global shortcut if it changed
      if (updates.toggleShortcut !== undefined && updates.toggleShortcut !== prev.toggleShortcut) {
        await invoke("update_shortcut", {
          oldShortcut: prev.toggleShortcut,
          newShortcut: updates.toggleShortcut,
        });
      }
    } catch (e) {
      console.error("[settings] Failed to save:", e);
      // Rollback on error
      set({ settings: prev });
    }
  },
}));
