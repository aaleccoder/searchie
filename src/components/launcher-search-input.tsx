import * as React from "react";
import { CircleHelp, Search, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type LauncherSearchInputProps = {
  value: string;
  placeholder: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onValueChange: (next: string) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onOpenSettings: () => void;
  onOpenHotkeysHelp: () => void;
};

export function LauncherSearchInput({
  value,
  placeholder,
  inputRef,
  onValueChange,
  onKeyDown,
  onOpenSettings,
  onOpenHotkeysHelp,
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
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-10 top-0 h-10 w-10 rounded-none text-muted-foreground hover:text-foreground"
        onClick={onOpenHotkeysHelp}
        aria-label="Show keyboard shortcuts"
      >
        <CircleHelp className="size-4" />
      </Button>
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
