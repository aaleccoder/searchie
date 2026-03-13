import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { InformationCircleIcon, MoreHorizontalCircle01Icon, SearchIcon } from "@hugeicons/core-free-icons";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type LauncherSearchInputProps = {
  value: string;
  placeholder: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onValueChange: (next: string) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  showBackButton?: boolean;
  onBackToDefault?: () => void;
  onOpenSettings: () => void;
  onOpenHotkeysHelp: () => void;
};

export function LauncherSearchInput({
  value,
  placeholder,
  inputRef,
  onValueChange,
  onKeyDown,
  showBackButton = false,
  onBackToDefault,
  onOpenSettings,
  onOpenHotkeysHelp,
}: LauncherSearchInputProps) {
  return (
    <div className="flex h-11.25 w-full items-center backdrop-blur-md" data-tauri-drag-region>
      {showBackButton ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-10 w-10 shrink-0 rounded-none text-muted-foreground bg-transparent! hover:bg-transparent! focus-visible:bg-transparent! dark:bg-transparent! dark:hover:bg-transparent! dark:focus-visible:bg-transparent! hover:text-foreground"
          onClick={onBackToDefault}
          aria-label="Go back to default panel"
          title="Go back (Left Arrow)"
        >
          <ArrowLeft className="size-4" />
        </Button>
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center text-muted-foreground" aria-hidden>
          <HugeiconsIcon icon={SearchIcon} strokeWidth={2} className="pointer-events-none size-4" />
        </div>
      )}
      <Input
        ref={inputRef}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className="h-full flex-1 rounded-none border-0 bg-transparent pl-0 pr-0 shadow-none hover:bg-transparent focus-visible:bg-transparent focus-visible:ring-0 dark:bg-transparent dark:hover:bg-transparent dark:focus-visible:bg-transparent"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
      />
      <Button
        variant="ghost"
        size="icon"
        className="h-10 w-10 shrink-0 rounded-none text-muted-foreground bg-transparent! hover:bg-transparent! focus-visible:bg-transparent! dark:bg-transparent! dark:hover:bg-transparent! dark:focus-visible:bg-transparent! hover:text-foreground"
        onClick={onOpenHotkeysHelp}
        aria-label="Show keyboard shortcuts"
      >
        <HugeiconsIcon icon={InformationCircleIcon} strokeWidth={2} className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-10 w-10 shrink-0 rounded-none text-muted-foreground bg-transparent! hover:bg-transparent! focus-visible:bg-transparent! dark:bg-transparent! dark:hover:bg-transparent! dark:focus-visible:bg-transparent! hover:text-foreground"
        onClick={onOpenSettings}
        aria-label="Open settings"
      >
        <HugeiconsIcon icon={MoreHorizontalCircle01Icon} strokeWidth={2} className="size-4" />
      </Button>
    </div>
  );
}
