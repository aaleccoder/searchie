import { useCallback, useEffect, useMemo, useState } from "react";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import {
  ensurePluginConfigDefaults,
  readPluginConfigSnapshot,
  writePluginConfig,
} from "@/lib/plugin-config-store";
import type { PluginConfigDefinition, PluginConfigValue } from "@/lib/plugin-contract";
import { usePluginRegistry } from "@/components/providers/panel-registry-provider";
import { useTheme } from "@/components/theme-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Settings } from "@/lib/settings-schema";
import { useSettingsStore } from "@/lib/settings-store";
import { cn } from "@/lib/utils";

// Maps a KeyboardEvent to a Tauri-compatible accelerator string.
function buildShortcut(e: KeyboardEvent): string | null {
  const modifiers: string[] = [];
  if (e.ctrlKey) modifiers.push("Ctrl");
  if (e.metaKey) modifiers.push("Super");
  if (e.altKey) modifiers.push("Alt");
  if (e.shiftKey) modifiers.push("Shift");

  const ignored = ["Control", "Meta", "Alt", "Shift", "Dead"];
  if (ignored.includes(e.key)) return null;

  const key = e.key === " " ? "Space" : e.key.length === 1 ? e.key.toUpperCase() : e.key;
  return [...modifiers, key].join("+");
}

function ShortcutRecorder({
  value,
  onChange,
}: {
  value: string;
  onChange: (shortcut: string) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Escape") {
        setRecording(false);
        setPending(null);
        return;
      }

      const shortcut = buildShortcut(e);
      if (shortcut) {
        setPending(shortcut);
        onChange(shortcut);
        setRecording(false);
      }
    },
    [onChange],
  );

  useEffect(() => {
    if (recording) {
      window.addEventListener("keydown", handleKeyDown, { capture: true });
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, [recording, handleKeyDown]);

  const display = pending ?? value;

  return (
    <div className="flex items-center gap-3">
      <Badge variant="outline" className="font-mono text-sm px-3 py-1 min-w-28 justify-center">
        {display || "-"}
      </Badge>
      <Button
        size="sm"
        variant={recording ? "destructive" : "outline"}
        onClick={() => {
          setPending(null);
          setRecording((r) => !r);
        }}
      >
        {recording ? "Press keys... (Esc to cancel)" : "Change shortcut"}
      </Button>
    </div>
  );
}

type SettingsPanelProps = {
  className?: string;
};

type PluginSettingsState = {
  loading: boolean;
  values: Record<string, PluginConfigValue>;
};

function pluginSettingId(pluginId: string, key: string): string {
  return `${pluginId}:${key}`;
}

export function SettingsPanel({ className }: SettingsPanelProps) {
  const { settings, loading, updateSettings } = useSettingsStore();
  const pluginRegistry = usePluginRegistry();
  const { setTheme } = useTheme();
  const [autostart, setAutostart] = useState<boolean | null>(null);
  const [pluginStates, setPluginStates] = useState<Record<string, PluginSettingsState>>({});

  const pluginSettings = useMemo(() => pluginRegistry.listPluginSettings(), [pluginRegistry]);

  useEffect(() => {
    let cancelled = false;

    const loadPluginSettings = async () => {
      const nextState: Record<string, PluginSettingsState> = {};
      for (const plugin of pluginSettings) {
        nextState[plugin.pluginId] = { loading: true, values: {} };
      }
      if (!cancelled) {
        setPluginStates(nextState);
      }

      for (const plugin of pluginSettings) {
        try {
          await ensurePluginConfigDefaults(plugin.pluginId);
          const values = await readPluginConfigSnapshot(plugin.pluginId);
          if (!cancelled) {
            setPluginStates((current) => ({
              ...current,
              [plugin.pluginId]: { loading: false, values },
            }));
          }
        } catch (error) {
          console.error(`[settings] Failed loading plugin settings for ${plugin.pluginId}:`, error);
          if (!cancelled) {
            setPluginStates((current) => ({
              ...current,
              [plugin.pluginId]: { loading: false, values: {} },
            }));
          }
        }
      }
    };

    void loadPluginSettings();
    return () => {
      cancelled = true;
    };
  }, [pluginSettings]);

  useEffect(() => {
    isEnabled().then(setAutostart).catch(() => setAutostart(false));
  }, []);

  const handleAutostartChange = async (checked: boolean) => {
    try {
      if (checked) {
        await enable();
      } else {
        await disable();
      }
      setAutostart(checked);
    } catch (e) {
      console.error("[autostart] Failed to update:", e);
    }
  };

  useEffect(() => {
    if (!loading) {
      setTheme(settings.theme);
    }
  }, [settings.theme, loading, setTheme]);

  const handleThemeChange = (value: Settings["theme"]) => {
    void updateSettings({ theme: value });
    setTheme(value);
  };

  const handlePluginSettingChange = useCallback(
    async (pluginId: string, definition: PluginConfigDefinition, value: PluginConfigValue) => {
      const key = definition.key;
      setPluginStates((current) => ({
        ...current,
        [pluginId]: {
          loading: false,
          values: {
            ...(current[pluginId]?.values ?? {}),
            [key]: value,
          },
        },
      }));

      try {
        await writePluginConfig(pluginId, key, value);
      } catch (error) {
        console.error(`[settings] Failed saving plugin setting ${pluginId}:${key}:`, error);
        const values = await readPluginConfigSnapshot(pluginId);
        setPluginStates((current) => ({
          ...current,
          [pluginId]: { loading: false, values },
        }));
      }
    },
    [],
  );

  return (
    <div className={cn("space-y-6", className)}>
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Settings</h2>
        <p className="text-sm text-muted-foreground mt-1">Tune Searchie to your workflow.</p>
      </div>

      <Separator />

      <div className="space-y-3">
        <div>
          <Label className="text-base font-medium">Toggle shortcut</Label>
          <p className="text-sm text-muted-foreground mt-0.5">
            Global hotkey to show or hide the search bar.
          </p>
        </div>
        {loading ? (
          <Skeleton className="h-9 w-56" />
        ) : (
          <ShortcutRecorder
            value={settings.toggleShortcut}
            onChange={(shortcut) => {
              void updateSettings({ toggleShortcut: shortcut });
            }}
          />
        )}
      </div>

      <Separator />

      <div className="space-y-3">
        <div>
          <Label className="text-base font-medium">Launch at login</Label>
          <p className="text-sm text-muted-foreground mt-0.5">
            Automatically start Searchie when you log in.
          </p>
        </div>
        {autostart === null ? (
          <Skeleton className="h-5 w-8 rounded-full" />
        ) : (
          <Switch checked={autostart} onCheckedChange={(checked) => void handleAutostartChange(checked)} />
        )}
      </div>

      <Separator />

      <div className="space-y-3">
        <div>
          <Label className="text-base font-medium">Theme</Label>
          <p className="text-sm text-muted-foreground mt-0.5">Choose how Searchie looks.</p>
        </div>
        {loading ? (
          <Skeleton className="h-9 w-36" />
        ) : (
          <Select
            value={settings.theme}
            onValueChange={(value) => {
              if (value) {
                handleThemeChange(value);
              }
            }}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
              <SelectItem value="system">System</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {pluginSettings.length > 0 ? (
        <>
          <Separator />

          <div className="space-y-3">
            <div>
              <Label className="text-base font-medium">Plugin Settings</Label>
              <p className="text-sm text-muted-foreground mt-0.5">
                Configure plugin-specific options provided by installed plugins.
              </p>
            </div>

            <div className="space-y-3">
              {pluginSettings.map((plugin) => {
                const state = pluginStates[plugin.pluginId] ?? { loading: true, values: {} };

                return (
                  <Card key={plugin.pluginId} size="sm">
                    <CardHeader>
                      <CardTitle>{plugin.pluginName}</CardTitle>
                      <CardDescription>{plugin.pluginId}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {plugin.definitions.map((definition) => {
                        const id = pluginSettingId(plugin.pluginId, definition.key);
                        const currentValue = state.values[definition.key] ?? definition.defaultValue;

                        return (
                          <div key={definition.key} className="space-y-2">
                            <Label htmlFor={id} className="text-sm font-medium">
                              {definition.label}
                            </Label>
                            {definition.description ? (
                              <p className="text-xs text-muted-foreground">{definition.description}</p>
                            ) : null}

                            {state.loading ? (
                              <Skeleton className="h-8 w-full" />
                            ) : definition.valueType === "boolean" ? (
                              <Switch
                                id={id}
                                checked={Boolean(currentValue)}
                                onCheckedChange={(checked) => {
                                  void handlePluginSettingChange(plugin.pluginId, definition, checked);
                                }}
                              />
                            ) : definition.valueType === "number" ? (
                              <Input
                                id={id}
                                type="number"
                                value={typeof currentValue === "number" ? String(currentValue) : ""}
                                onChange={(event) => {
                                  const next = Number(event.target.value);
                                  if (!Number.isNaN(next)) {
                                    void handlePluginSettingChange(plugin.pluginId, definition, next);
                                  }
                                }}
                              />
                            ) : definition.valueType === "string" ? (
                              <Input
                                id={id}
                                type="text"
                                value={typeof currentValue === "string" ? currentValue : ""}
                                onChange={(event) => {
                                  void handlePluginSettingChange(plugin.pluginId, definition, event.target.value);
                                }}
                              />
                            ) : (
                                <Select
                                  value={typeof currentValue === "string" ? currentValue : ""}
                                  onValueChange={(value) => {
                                  if (value !== null) {
                                    void handlePluginSettingChange(plugin.pluginId, definition, value);
                                  }
                                  }}
                                >
                                <SelectTrigger id={id} className="w-full">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {definition.valueType.options.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
