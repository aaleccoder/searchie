import { useCallback, useEffect, useState } from "react";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import { useTheme } from "@/components/theme-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

export function SettingsPanel() {
  const { settings, loading, updateSettings } = useSettingsStore();
  const { setTheme } = useTheme();
  const [autostart, setAutostart] = useState<boolean | null>(null);

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

  return (
    <div className="space-y-6">
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
          <Select value={settings.theme} onValueChange={handleThemeChange}>
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
    </div>
  );
}
