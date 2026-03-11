import * as React from "react";
import { CircleHelp, Search, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { PanelShortcutHint } from "@/lib/panel-contract";

type LauncherSearchInputProps = {
  value: string;
  placeholder: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onValueChange: (next: string) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onOpenSettings: () => void;
  shortcutHints: PanelShortcutHint[];
  shortcutContextLabel: string;
};

function formatShortcutPart(part: string): string {
  const normalized = part.trim().toLowerCase();
  if (normalized === "mod") return "Ctrl/Cmd";
  if (normalized === "arrowup") return "Up";
  if (normalized === "arrowdown") return "Down";
  if (normalized === "arrowleft") return "Left";
  if (normalized === "arrowright") return "Right";
  return part.trim();
}

export function LauncherSearchInput({
  value,
  placeholder,
  inputRef,
  onValueChange,
  onKeyDown,
  onOpenSettings,
  shortcutHints,
  shortcutContextLabel,
}: LauncherSearchInputProps) {
  return (
    <div className="relative h-10 w-full backdrop-blur-md" data-tauri-drag-region>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className="h-full rounded-none border-0 bg-transparent pl-10 pr-21 shadow-none focus-visible:ring-0"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
      />
      <Popover>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-10 top-0 h-10 w-10 rounded-none text-muted-foreground hover:text-foreground"
              aria-label="Show keyboard shortcuts"
            >
              <CircleHelp className="size-4" />
            </Button>
          }
        />
        <PopoverContent className="w-84" align="end">
          <PopoverHeader>
            <PopoverTitle>{shortcutContextLabel} hotkeys</PopoverTitle>
            <PopoverDescription>Available keyboard shortcuts for your current context.</PopoverDescription>
          </PopoverHeader>
          <div className="space-y-2">
            {shortcutHints.map((hint) => (
              <div key={`${hint.keys}:${hint.description}`} className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">{hint.description}</span>
                <KbdGroup>
                  {hint.keys.split("+").map((part) => (
                    <Kbd key={`${hint.keys}:${part}`}>{formatShortcutPart(part)}</Kbd>
                  ))}
                </KbdGroup>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-0 top-0 h-10 w-10 rounded-none text-muted-foreground hover:text-foreground"
        onClick={onOpenSettings}
        aria-label="Open settings"
      >
        <Settings2 className="size-4" />
      </Button>
    </div>
  );
}
