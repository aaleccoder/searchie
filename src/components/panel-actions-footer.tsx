import * as React from "react";
import { ChevronDown } from "lucide-react";
import type { PanelFooterConfig, PanelFooterControls } from "@/lib/panel-contract";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type PanelActionsFooterProps = {
  footer: PanelFooterConfig;
};

export function PanelActionsFooter({ footer }: PanelActionsFooterProps) {
  const primaryAction = footer.primaryAction;
  const extraActions = footer.extraActions ?? [];
  const [extrasOpen, setExtrasOpen] = React.useState(false);

  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const itemRefs = React.useRef<Map<string, HTMLDivElement>>(new Map());
  const restoreFocusRef = React.useRef<HTMLElement | null>(null);

  const captureCurrentFocus = React.useCallback(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement) {
      restoreFocusRef.current = active;
    }
  }, []);

  const restorePreviousFocus = React.useCallback(() => {
    const target = restoreFocusRef.current;
    if (target && target.isConnected) {
      target.focus();
      return;
    }

    triggerRef.current?.focus();
  }, []);

  const firstEnabledExtraIndex = React.useMemo(() => {
    return Math.max(
      0,
      extraActions.findIndex((action) => !action.disabled && !action.loading),
    );
  }, [extraActions]);

  const runAction = React.useCallback((action: NonNullable<PanelFooterConfig["primaryAction"]>) => {
    void Promise.resolve(action.onSelect());
  }, []);

  const focusExtraAction = React.useCallback(
    (index: number) => {
      const boundedIndex = Math.max(0, Math.min(extraActions.length - 1, index));
      const action = extraActions[boundedIndex];
      if (!action) {
        return;
      }

      const target = itemRefs.current.get(action.id);
      target?.focus();
    },
    [extraActions],
  );

  const runPrimaryAction = React.useCallback(() => {
    if (!primaryAction || primaryAction.disabled || primaryAction.loading) {
      return false;
    }

    runAction(primaryAction);
    return true;
  }, [primaryAction, runAction]);

  const runExtraActionById = React.useCallback(
    (actionId: string) => {
      const action = extraActions.find((item) => item.id === actionId);
      if (!action || action.disabled || action.loading) {
        return false;
      }

      runAction(action);
      return true;
    },
    [extraActions, runAction],
  );

  const controls = React.useMemo<PanelFooterControls>(
    () => ({
      openExtraActions: () => {
        if (extraActions.length === 0) {
          return;
        }

        captureCurrentFocus();
        setExtrasOpen(true);
        window.setTimeout(() => {
          focusExtraAction(firstEnabledExtraIndex);
        }, 0);
      },
      closeExtraActions: () => {
        setExtrasOpen(false);
        window.setTimeout(() => {
          restorePreviousFocus();
        }, 0);
      },
      toggleExtraActions: () => {
        if (extraActions.length === 0) {
          return;
        }

        setExtrasOpen((prev) => {
          const next = !prev;
          if (next) {
            captureCurrentFocus();
            window.setTimeout(() => {
              focusExtraAction(firstEnabledExtraIndex);
            }, 0);
          } else {
            window.setTimeout(() => {
              restorePreviousFocus();
            }, 0);
          }
          return next;
        });
      },
      runPrimaryAction,
      runExtraActionById,
    }),
    [
      captureCurrentFocus,
      extraActions.length,
      firstEnabledExtraIndex,
      focusExtraAction,
      restorePreviousFocus,
      runExtraActionById,
      runPrimaryAction,
    ],
  );

  React.useEffect(() => {
    footer.registerControls?.(controls);
    return () => {
      footer.registerControls?.(null);
    };
  }, [controls, footer]);

  React.useEffect(() => {
    if (!extrasOpen) {
      return;
    }

    window.setTimeout(() => {
      focusExtraAction(firstEnabledExtraIndex);
    }, 0);
  }, [extrasOpen, firstEnabledExtraIndex, focusExtraAction]);

  const onExtrasOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        captureCurrentFocus();
      }

      setExtrasOpen(nextOpen);

      if (!nextOpen) {
        window.setTimeout(() => {
          restorePreviousFocus();
        }, 0);
      }
    },
    [captureCurrentFocus, restorePreviousFocus],
  );

  return (
    <div className="flex items-center justify-between gap-3 border-t border-border/60 bg-card/70 px-3 py-2 backdrop-blur-sm">
      <p className="min-w-0 truncate text-xs text-muted-foreground">{footer.helperText ?? "Actions"}</p>
      <div className="flex shrink-0 items-center gap-2">
        {primaryAction ? (
          <Button
            size="sm"
            onClick={() => runAction(primaryAction)}
            disabled={primaryAction.disabled || primaryAction.loading}
          >
            {primaryAction.icon ? <primaryAction.icon className="size-4" /> : null}
            {primaryAction.loading ? "Working..." : primaryAction.label}
          </Button>
        ) : null}

        {extraActions.length > 0 ? (
          <DropdownMenu open={extrasOpen} onOpenChange={onExtrasOpenChange}>
            <DropdownMenuTrigger
              render={
                <Button ref={triggerRef} variant="outline" size="sm">
                  <span>More</span>
                  <ChevronDown className="size-3.5" />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-56">
              {extraActions.map((action) => (
                <DropdownMenuItem
                  key={action.id}
                  ref={(el) => {
                    if (el) {
                      itemRefs.current.set(action.id, el);
                    } else {
                      itemRefs.current.delete(action.id);
                    }
                  }}
                  disabled={action.disabled || action.loading}
                  onClick={() => runAction(action)}
                  variant={action.destructive ? "destructive" : "default"}
                >
                  {action.icon ? <action.icon className="size-4" /> : null}
                  {action.loading ? "Working..." : action.label}
                  {action.shortcutHint ? (
                    <DropdownMenuShortcut>{action.shortcutHint}</DropdownMenuShortcut>
                  ) : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </div>
  );
}
