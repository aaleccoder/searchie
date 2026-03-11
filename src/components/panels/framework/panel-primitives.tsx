import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export const PanelBadge = Badge;
export const PanelButton = Button;
export const PanelEmpty = Empty;
export const PanelEmptyDescription = EmptyDescription;
export const PanelEmptyHeader = EmptyHeader;
export const PanelEmptyMedia = EmptyMedia;
export const PanelEmptyTitle = EmptyTitle;
export const PanelInput = Input;
export const PanelKbd = Kbd;
export const PanelKbdGroup = KbdGroup;
export const PanelScrollArea = ScrollArea;
export const PanelSelect = Select;
export const PanelSelectContent = SelectContent;
export const PanelSelectItem = SelectItem;
export const PanelSelectTrigger = SelectTrigger;
export const PanelSelectValue = SelectValue;
export const PanelTooltip = Tooltip;
export const PanelTooltipContent = TooltipContent;
export const PanelTooltipProvider = TooltipProvider;
export const PanelTooltipTrigger = TooltipTrigger;

type DivProps = React.HTMLAttributes<HTMLDivElement>;

export function PanelGrid({ className, ...props }: DivProps) {
  return <div className={cn("grid h-full items-stretch gap-2.5", className)} {...props} />;
}

export function PanelList({ className, ...props }: DivProps) {
  return <div className={cn("space-y-2", className)} {...props} />;
}

type PanelListItemProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

export const panelListItemVariants = {
  active: "border-primary/70 bg-primary/10",
  idle: "border-border/55 hover:border-primary/45 hover:bg-accent/40",
};

export function PanelListItem({ className, ...props }: PanelListItemProps) {
  return (
    <button
      type="button"
      className={cn(
        "w-full min-w-0 rounded-lg border px-3 py-2 text-left transition",
        panelListItemVariants.idle,
        className,
      )}
      {...props}
    />
  );
}

export function PanelMetaGrid({ className, ...props }: DivProps) {
  return <div className={cn("grid grid-cols-[auto_1fr] items-center gap-4", className)} {...props} />;
}
