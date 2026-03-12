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

type SpacingToken = "none" | "xs" | "sm" | "md" | "lg";
type RadiusToken = "none" | "sm" | "md" | "lg";
type SurfaceToken = "none" | "panel" | "muted";

const spacingClasses: Record<SpacingToken, string> = {
  none: "",
  xs: "gap-1",
  sm: "gap-2",
  md: "gap-3",
  lg: "gap-4",
};

const paddingClasses: Record<SpacingToken, string> = {
  none: "",
  xs: "p-1",
  sm: "p-2",
  md: "p-3",
  lg: "p-4",
};

const radiusClasses: Record<RadiusToken, string> = {
  none: "",
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
};

const surfaceClasses: Record<SurfaceToken, string> = {
  none: "",
  panel: "rounded-xl border border-border/70 bg-card/92 shadow-lg",
  muted: "rounded-lg border border-border/60 bg-muted/20",
};

type PanelContainerProps = DivProps & {
  surface?: SurfaceToken;
  padding?: SpacingToken;
  radius?: RadiusToken;
};

export const PanelContainer = React.forwardRef<HTMLDivElement, PanelContainerProps>(
  ({ className, surface = "none", padding = "none", radius = "none", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(surfaceClasses[surface], paddingClasses[padding], radiusClasses[radius], className)}
        {...props}
      />
    );
  },
);
PanelContainer.displayName = "PanelContainer";

type PanelFlexProps = DivProps & {
  direction?: "row" | "col";
  align?: "start" | "center" | "end" | "stretch";
  justify?: "start" | "center" | "between" | "end";
  gap?: SpacingToken;
};

const flexAlignClasses = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch",
} as const;

const flexJustifyClasses = {
  start: "justify-start",
  center: "justify-center",
  between: "justify-between",
  end: "justify-end",
} as const;

export const PanelFlex = React.forwardRef<HTMLDivElement, PanelFlexProps>(
  (
    {
      className,
      direction = "row",
      align = "stretch",
      justify = "start",
      gap = "none",
      ...props
    },
    ref,
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex",
          direction === "col" ? "flex-col" : "flex-row",
          flexAlignClasses[align],
          flexJustifyClasses[justify],
          spacingClasses[gap],
          className,
        )}
        {...props}
      />
    );
  },
);
PanelFlex.displayName = "PanelFlex";

type PanelGridProps = DivProps & {
  columns?: "single" | "two-pane" | "meta";
  gap?: SpacingToken;
};

const gridColumnClasses = {
  single: "grid-cols-1",
  "two-pane": "grid-cols-[1.45fr_1fr]",
  meta: "grid-cols-[auto_1fr]",
} as const;

export const PanelGrid = React.forwardRef<HTMLDivElement, PanelGridProps>(
  ({ className, columns = "single", gap = "md", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("grid h-full items-stretch", gridColumnClasses[columns], spacingClasses[gap], className)}
        {...props}
      />
    );
  },
);
PanelGrid.displayName = "PanelGrid";

export const PanelSection = React.forwardRef<HTMLElement, SectionProps>(({ className, ...props }, ref) => {
  return <section ref={ref} className={cn(className)} {...props} />;
});
PanelSection.displayName = "PanelSection";

export const PanelAside = React.forwardRef<HTMLElement, SectionProps>(({ className, ...props }, ref) => {
  return <aside ref={ref} className={cn(className)} {...props} />;
});
PanelAside.displayName = "PanelAside";

export const PanelArticle = React.forwardRef<HTMLElement, SectionProps>(({ className, ...props }, ref) => {
  return <article ref={ref} className={cn(className)} {...props} />;
});
PanelArticle.displayName = "PanelArticle";

type PanelTextProps = SpanProps & {
  tone?: "default" | "muted";
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  weight?: "normal" | "medium" | "semibold";
  truncate?: boolean;
  mono?: boolean;
};

const textToneClasses = {
  default: "text-foreground",
  muted: "text-muted-foreground",
} as const;

const textSizeClasses = {
  xs: "text-xs",
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
  xl: "text-xl",
} as const;

const textWeightClasses = {
  normal: "font-normal",
  medium: "font-medium",
  semibold: "font-semibold",
} as const;

export const PanelText = React.forwardRef<HTMLSpanElement, PanelTextProps>(
  (
    {
      className,
      tone = "default",
      size = "sm",
      weight = "normal",
      truncate = false,
      mono = false,
      ...props
    },
    ref,
  ) => {
    return (
      <span
        ref={ref}
        className={cn(
          textToneClasses[tone],
          textSizeClasses[size],
          textWeightClasses[weight],
          truncate && "truncate whitespace-nowrap",
          mono && "font-mono",
          className,
        )}
        {...props}
      />
    );
  },
);
PanelText.displayName = "PanelText";

export const PanelInline = PanelText;

type PanelParagraphProps = ParagraphProps & {
  tone?: "default" | "muted";
  size?: "xs" | "sm" | "md";
};

export const PanelParagraph = React.forwardRef<HTMLParagraphElement, PanelParagraphProps>(
  ({ className, tone = "default", size = "sm", ...props }, ref) => {
    return <p ref={ref} className={cn(textToneClasses[tone], textSizeClasses[size], className)} {...props} />;
  },
);
PanelParagraph.displayName = "PanelParagraph";

type PanelHeadingProps = React.HTMLAttributes<HTMLHeadingElement> & {
  level?: 1 | 2 | 3 | 4;
};

export function PanelHeading({ level = 3, className, ...props }: PanelHeadingProps) {
  const headingClassName = cn("font-semibold leading-tight", className);
  if (level === 1) {
    return <h1 className={cn("text-2xl", headingClassName)} {...props} />;
  }
  if (level === 2) {
    return <h2 className={cn("text-xl", headingClassName)} {...props} />;
  }
  if (level === 4) {
    return <h4 className={cn("text-sm", headingClassName)} {...props} />;
  }
  return <h3 className={cn("text-lg", headingClassName)} {...props} />;
}

export const PanelCode = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  ({ className, ...props }, ref) => {
    return <code ref={ref} className={cn("font-mono text-xs", className)} {...props} />;
  },
);
PanelCode.displayName = "PanelCode";

export const PanelPre = React.forwardRef<HTMLPreElement, React.HTMLAttributes<HTMLPreElement>>(
  ({ className, ...props }, ref) => {
    return <pre ref={ref} className={cn("font-sans text-sm", className)} {...props} />;
  },
);
PanelPre.displayName = "PanelPre";

type PanelTextButtonProps = ButtonProps & {
  tone?: "ghost" | "subtle" | "active";
};

const textButtonToneClasses = {
  ghost: "border-transparent hover:border-primary/40 hover:bg-accent/50",
  subtle: "border-border/55 hover:border-primary/45 hover:bg-accent/40",
  active: "border-primary/70 bg-primary/10",
} as const;

export const PanelTextButton = React.forwardRef<HTMLButtonElement, PanelTextButtonProps>(
  ({ className, tone = "ghost", type = "button", ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "w-full rounded-lg border px-3 py-2 text-left transition cursor-pointer outline-none focus-visible:outline-none focus-visible:ring-0",
          textButtonToneClasses[tone],
          className,
        )}
        {...props}
      />
    );
  },
);
PanelTextButton.displayName = "PanelTextButton";

export const PanelFigureImage = React.forwardRef<HTMLImageElement, ImageProps>(
  ({ className, alt = "", ...props }, ref) => {
    return <img ref={ref} className={cn(className)} alt={alt} {...props} />;
  },
);
PanelFigureImage.displayName = "PanelFigureImage";
type PanelListProps = DivProps & { gap?: SpacingToken };

export const PanelList = React.forwardRef<HTMLDivElement, PanelListProps>(
  ({ className, gap = "sm", ...props }, ref) => {
    return <div ref={ref} className={cn(spacingClasses[gap], className)} {...props} />;
  },
);
PanelList.displayName = "PanelList";

type PanelListItemProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

export const panelListItemVariants = {
  active: "border-primary/70 bg-primary/10",
  idle: "border-border/55 hover:border-primary/45 hover:bg-accent/40",
};

export const PanelListItem = React.forwardRef<HTMLButtonElement, PanelListItemProps>(
  ({ className, type = "button", ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "w-full min-w-0 rounded-lg border px-3 py-2 text-left transition outline-none focus-visible:outline-none focus-visible:ring-0",
          panelListItemVariants.idle,
          className,
        )}
        {...props}
      />
    );
  },
);
PanelListItem.displayName = "PanelListItem";

export const PanelMetaGrid = React.forwardRef<HTMLDivElement, DivProps>(({ className, ...props }, ref) => {
  return <div ref={ref} className={cn("grid grid-cols-[auto_1fr] items-center gap-4", className)} {...props} />;
});
PanelMetaGrid.displayName = "PanelMetaGrid";
