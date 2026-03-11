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
type SpanProps = React.HTMLAttributes<HTMLSpanElement>;
type ParagraphProps = React.HTMLAttributes<HTMLParagraphElement>;
type SectionProps = React.HTMLAttributes<HTMLElement>;
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>;
type ImageProps = React.ImgHTMLAttributes<HTMLImageElement>;

export function PanelContainer({ className, ...props }: DivProps) {
  return <div className={cn(className)} {...props} />;
}

export function PanelFlex({ className, ...props }: DivProps) {
  return <div className={cn("flex", className)} {...props} />;
}

export function PanelSection({ className, ...props }: SectionProps) {
  return <section className={cn(className)} {...props} />;
}

export function PanelAside({ className, ...props }: SectionProps) {
  return <aside className={cn(className)} {...props} />;
}

export function PanelArticle({ className, ...props }: SectionProps) {
  return <article className={cn(className)} {...props} />;
}

export function PanelText({ className, ...props }: SpanProps) {
  return <span className={cn(className)} {...props} />;
}

export function PanelInline({ className, ...props }: SpanProps) {
  return <span className={cn(className)} {...props} />;
}

export function PanelParagraph({ className, ...props }: ParagraphProps) {
  return <p className={cn(className)} {...props} />;
}

type PanelHeadingProps = React.HTMLAttributes<HTMLHeadingElement> & {
  level?: 1 | 2 | 3 | 4;
};

export function PanelHeading({ level = 3, className, ...props }: PanelHeadingProps) {
  if (level === 1) {
    return <h1 className={cn(className)} {...props} />;
  }
  if (level === 2) {
    return <h2 className={cn(className)} {...props} />;
  }
  if (level === 4) {
    return <h4 className={cn(className)} {...props} />;
  }
  return <h3 className={cn(className)} {...props} />;
}

export function PanelCode({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return <code className={cn(className)} {...props} />;
}

export function PanelPre({ className, ...props }: React.HTMLAttributes<HTMLPreElement>) {
  return <pre className={cn(className)} {...props} />;
}

export function PanelTextButton({ className, ...props }: ButtonProps) {
  return <button type="button" className={cn(className)} {...props} />;
}

export function PanelFigureImage({ className, alt = "", ...props }: ImageProps) {
  return <img className={cn(className)} alt={alt} {...props} />;
}

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
