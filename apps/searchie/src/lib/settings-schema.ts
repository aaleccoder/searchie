import { z } from "zod";

export const settingsSchema = z.object({
  toggleShortcut: z.string().default("Alt+Space"),
  theme: z.enum(["light", "dark", "system"]).default("dark"),
  runtimePluginsDevelopFolder: z.string().optional(),
});

export type Settings = z.infer<typeof settingsSchema>;

export const defaultSettings: Settings = settingsSchema.parse({});
