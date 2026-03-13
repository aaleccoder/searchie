import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

type DivProps = React.HTMLAttributes<HTMLDivElement>;
type SpanProps = React.HTMLAttributes<HTMLSpanElement>;
type ParagraphProps = React.HTMLAttributes<HTMLParagraphElement>;
type SectionProps = React.HTMLAttributes<HTMLElement>;
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>;
type ImageProps = React.ImgHTMLAttributes<HTMLImageElement>;

function splitClassName<T extends object>(props: T): {
  className?: string;
  restProps: T;
} {
  const { className, ...restProps } = props as T & { className?: string };
  return {
    className,
    restProps: restProps as T,
  };
}

export type SpacingToken = "none" | "xs" | "sm" | "md" | "lg";
export type RadiusToken = "none" | "sm" | "md" | "lg";
export type SurfaceToken = "none" | "panel" | "muted";

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

export type PanelContainerProps = DivProps & {
  surface?: SurfaceToken;
  padding?: SpacingToken;
  radius?: RadiusToken;
};

export const PanelContainer = React.forwardRef<HTMLDivElement, PanelContainerProps>(
  ({ surface = "none", padding = "none", radius = "none", ...props }, ref) => {
    const { className, restProps } = splitClassName(props);
    return (
      <div
        ref={ref}
        className={cn("min-w-0", surfaceClasses[surface], paddingClasses[padding], radiusClasses[radius], className)}
        {...restProps}
      />
    );
  },
);
PanelContainer.displayName = "PanelContainer";

export type PanelFlexProps = DivProps & {
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
      direction = "row",
      align = "stretch",
      justify = "start",
      gap = "none",
      ...props
    },
    ref,
  ) => {
    const { className, restProps } = splitClassName(props);
    return (
      <div
        ref={ref}
        className={cn(
          "flex min-w-0",
          direction === "col" ? "flex-col" : "flex-row",
          flexAlignClasses[align],
          flexJustifyClasses[justify],
          spacingClasses[gap],
          className,
        )}
        {...restProps}
      />
    );
  },
);
PanelFlex.displayName = "PanelFlex";

export type PanelGridProps = DivProps & {
  columns?: "single" | "two-pane" | "meta";
  gap?: SpacingToken;
};

const gridColumnClasses = {
  single: "grid-cols-1",
  "two-pane": "grid-cols-[1.45fr_1fr]",
  meta: "grid-cols-[auto_1fr]",
} as const;

export const PanelGrid = React.forwardRef<HTMLDivElement, PanelGridProps>(
  ({ columns = "single", gap = "md", ...props }, ref) => {
    const { className, restProps } = splitClassName(props);
    return (
      <div
        ref={ref}
        className={cn("grid h-full w-full min-w-0 items-stretch", gridColumnClasses[columns], spacingClasses[gap], className)}
        {...restProps}
      />
    );
  },
);
PanelGrid.displayName = "PanelGrid";

export const PanelSection = React.forwardRef<HTMLElement, SectionProps>((props, ref) => {
  const { className, restProps } = splitClassName(props);
  return <section ref={ref} className={cn("min-w-0", className)} {...restProps} />;
});
PanelSection.displayName = "PanelSection";

export const PanelAside = React.forwardRef<HTMLElement, SectionProps>((props, ref) => {
  const { className, restProps } = splitClassName(props);
  return <aside ref={ref} className={cn("min-w-0 overflow-hidden", className)} {...restProps} />;
});
PanelAside.displayName = "PanelAside";

export const PanelArticle = React.forwardRef<HTMLElement, SectionProps>((props, ref) => {
  const { className, restProps } = splitClassName(props);
  return <article ref={ref} className={cn("min-w-0", className)} {...restProps} />;
});
PanelArticle.displayName = "PanelArticle";

export type PanelTextProps = SpanProps & {
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
      tone = "default",
      size = "sm",
      weight = "normal",
      truncate = false,
      mono = false,
      ...props
    },
    ref,
  ) => {
    const { className, restProps } = splitClassName(props);
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
        {...restProps}
      />
    );
  },
);
PanelText.displayName = "PanelText";

export const PanelInline = PanelText;

export type PanelParagraphProps = ParagraphProps & {
  tone?: "default" | "muted";
  size?: "xs" | "sm" | "md";
};

export const PanelParagraph = React.forwardRef<HTMLParagraphElement, PanelParagraphProps>(
  ({ tone = "default", size = "sm", ...props }, ref) => {
    const { className, restProps } = splitClassName(props);
    return (
      <p
        ref={ref}
        className={cn("leading-relaxed", textToneClasses[tone], textSizeClasses[size], className)}
        {...restProps}
      />
    );
  },
);
PanelParagraph.displayName = "PanelParagraph";

export type PanelHeadingProps = React.HTMLAttributes<HTMLHeadingElement> & {
  level?: 1 | 2 | 3 | 4;
};

export function PanelHeading({ level = 3, ...props }: PanelHeadingProps) {
  const { className, restProps } = splitClassName(props);
  const headingClassName = "font-semibold leading-tight";
  if (level === 1) {
    return <h1 className={cn("text-2xl", headingClassName, className)} {...restProps} />;
  }
  if (level === 2) {
    return <h2 className={cn("text-xl", headingClassName, className)} {...restProps} />;
  }
  if (level === 4) {
    return <h4 className={cn("text-sm", headingClassName, className)} {...restProps} />;
  }
  return <h3 className={cn("text-lg", headingClassName, className)} {...restProps} />;
}

export const PanelCode = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  (props, ref) => {
    const { className, restProps } = splitClassName(props);
    return <code ref={ref} className={cn("font-mono text-xs", className)} {...restProps} />;
  },
);
PanelCode.displayName = "PanelCode";

export const PanelPre = React.forwardRef<HTMLPreElement, React.HTMLAttributes<HTMLPreElement>>(
  (props, ref) => {
    const { className, restProps } = splitClassName(props);
    return <pre ref={ref} className={cn("font-sans text-sm", className)} {...restProps} />;
  },
);
PanelPre.displayName = "PanelPre";

export type PanelTextButtonProps = ButtonProps & {
  tone?: "ghost" | "subtle" | "active";
};

const textButtonToneClasses = {
  ghost: "border-transparent hover:border-primary/40 hover:bg-accent/50",
  subtle: "border-border/55 hover:border-primary/45 hover:bg-accent/40",
  active: "border-primary/70 bg-primary/10",
} as const;

export const PanelTextButton = React.forwardRef<HTMLButtonElement, PanelTextButtonProps>(
  ({ tone = "ghost", type = "button", ...props }, ref) => {
    const { className, restProps } = splitClassName(props);
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "w-full rounded-lg border px-3 py-2 text-left transition cursor-pointer outline-none focus-visible:outline-none focus-visible:ring-0",
          textButtonToneClasses[tone],
          className,
        )}
        {...restProps}
      />
    );
  },
);
PanelTextButton.displayName = "PanelTextButton";

export const PanelFigureImage = React.forwardRef<HTMLImageElement, ImageProps>(
  ({ alt = "", ...props }, ref) => {
    const { className, restProps } = splitClassName(props);
    return <img ref={ref} className={cn("rounded-sm object-contain", className)} alt={alt} {...restProps} />;
  },
);
PanelFigureImage.displayName = "PanelFigureImage";

export type PanelListVirtualizeConfig = {
  count: number;
  estimateSize: number;
  overscan?: number;
  getItemKey?: (index: number) => string | number;
  getScrollElement?: () => HTMLElement | null;
  renderItem: (index: number) => React.ReactNode;
  scrollToIndex?: number;
};

export type PanelListProps = DivProps & {
  gap?: SpacingToken;
  virtualize?: PanelListVirtualizeConfig;
};

const spacingPixels: Record<SpacingToken, number> = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
};

export const PanelList = React.forwardRef<HTMLDivElement, PanelListProps>(
  ({ gap = "sm", virtualize, ...props }, ref) => {
    const { className, restProps } = splitClassName(props);
    const scrollRef = React.useRef<HTMLDivElement | null>(null);
    const itemGapPx = spacingPixels[gap];
    const virtualCount = virtualize?.count ?? 0;
    const virtualEstimateSize = virtualize?.estimateSize ?? 0;
    const virtualOverscan = virtualize?.overscan ?? 6;
    const virtualGetItemKey = virtualize?.getItemKey;
    const virtualGetScrollElement = virtualize?.getScrollElement;
    const targetScrollIndex = virtualize?.scrollToIndex;
    const hasExternalScrollElement = !!virtualGetScrollElement;

    const virtualizer = useVirtualizer({
      count: virtualCount,
      getScrollElement: () => virtualGetScrollElement?.() ?? scrollRef.current,
      estimateSize: () => virtualEstimateSize + itemGapPx,
      overscan: virtualOverscan,
      initialRect: { width: 0, height: 400 },
      getItemKey: virtualGetItemKey,
    });

    React.useEffect(() => {
      if (!virtualize) {
        return;
      }

      virtualizer.measure();
    }, [virtualCount, virtualEstimateSize, itemGapPx, virtualize, virtualizer]);

    React.useEffect(() => {
      if (!virtualize || typeof targetScrollIndex !== "number" || targetScrollIndex < 0) {
        return;
      }

      const virtualItems = virtualizer.getVirtualItems();
      const targetItem = virtualItems.find((item) => item.index === targetScrollIndex);
      const viewportHeight = (virtualGetScrollElement?.() ?? scrollRef.current)?.clientHeight ?? 0;
      const viewportStart = virtualizer.scrollOffset ?? 0;
      const viewportEnd = viewportStart + viewportHeight;

      if (targetItem && viewportHeight > 0) {
        const isAboveViewport = targetItem.start < viewportStart;
        const isBelowViewport = targetItem.end > viewportEnd;

        if (!isAboveViewport && !isBelowViewport) {
          return;
        }

        virtualizer.scrollToIndex(targetScrollIndex, {
          align: isAboveViewport ? "start" : "end",
        });
        return;
      }

      virtualizer.scrollToIndex(targetScrollIndex, { align: "auto" });
    }, [targetScrollIndex, virtualize, virtualizer]);

    if (!virtualize) {
      return <div ref={ref} className={cn("p-0.5", spacingClasses[gap], className)} {...restProps} />;
    }

    const virtualItems = virtualizer.getVirtualItems();
    const fallbackItems =
      virtualItems.length === 0 && virtualize.count > 0
        ? [{ key: "fallback-0", index: 0, start: 0 }]
        : [];

    return (
      <div
        {...restProps}
        ref={(node) => {
          scrollRef.current = node;
          if (typeof ref === "function") {
            ref(node);
            return;
          }
          if (ref) {
            ref.current = node;
          }
        }}
        className={cn("relative p-0.5", !hasExternalScrollElement && "overflow-y-auto", className)}
      >
        <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
          {(virtualItems.length > 0 ? virtualItems : fallbackItems).map((virtualItem) => {
            const isLast = virtualItem.index === virtualize.count - 1;
            return (
              <div
                key={virtualItem.key}
                className="absolute left-0 top-0 w-full"
                style={{
                  transform: `translateY(${virtualItem.start}px)`,
                  paddingBottom: isLast ? 0 : itemGapPx,
                }}
              >
                {virtualize.renderItem(virtualItem.index)}
              </div>
            );
          })}
        </div>
      </div>
    );
  },
);
PanelList.displayName = "PanelList";

export type PanelListItemProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
};

export const panelListItemVariants = {
  active: "bg-primary/10",
  idle: "border-transparent hover:bg-accent/50",
};

export const PanelListItem = React.forwardRef<HTMLButtonElement, PanelListItemProps>(
  ({ type = "button", active = false, ...props }, ref) => {
    const { className, restProps } = splitClassName(props);
    return (
      <button
        ref={ref}
        type={type}
        data-active={active ? "true" : undefined}
        className={cn(
          "w-full min-w-0 rounded-lg border px-3 py-2 text-left transition outline-none focus-visible:outline-none focus-visible:ring-0 flex items-center gap-3 cursor-pointer focus-visible:bg-primary/10",
          active ? panelListItemVariants.active : panelListItemVariants.idle,
          className,
        )}
        {...restProps}
      />
    );
  },
);
PanelListItem.displayName = "PanelListItem";

export const PanelMetaGrid = React.forwardRef<HTMLDivElement, DivProps>((props, ref) => {
  const { className, restProps } = splitClassName(props);
  return (
    <div
      ref={ref}
      className={cn("grid grid-cols-[auto_1fr] items-center gap-4 min-w-0", className)}
      {...restProps}
    />
  );
});
PanelMetaGrid.displayName = "PanelMetaGrid";
