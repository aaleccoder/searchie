import * as React from "react";
import { Rocket } from "lucide-react";
import {
  PanelContainer,
  PanelFigureImage,
  PanelInline,
  PanelMetaGrid,
  PanelTooltip,
  PanelTooltipContent,
  PanelTooltipTrigger,
} from "@/components/framework/panel-primitives";
import { getCachedAppIcon } from "@/lib/apps-icon-cache";

type AppIconProps = {
  appId: string;
  cacheVersion: number;
};

export function AppIcon({ appId, cacheVersion }: AppIconProps) {
  const [failed, setFailed] = React.useState(false);
  const src = getCachedAppIcon(appId);

  React.useEffect(() => {
    setFailed(false);
  }, [appId, cacheVersion]);

  if (!src || failed) {
    return (
      <PanelContainer
        surface="muted"
        radius="sm"
        style={{ width: 24, height: 24, display: "grid", placeItems: "center", flexShrink: 0 }}
      >
        <Rocket size={14} />
      </PanelContainer>
    );
  }

  return (
    <PanelFigureImage
      src={src}
      alt=""
      onError={() => setFailed(true)}
      loading="lazy"
      style={{ width: 24, height: 24, flexShrink: 0 }}
    />
  );
}

type SingleLineTooltipTextProps = {
  text: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  tone?: "default" | "muted";
  mono?: boolean;
};

export function SingleLineTooltipText({
  text,
  size = "sm",
  tone = "default",
  mono = false,
}: SingleLineTooltipTextProps) {
  return (
    <PanelTooltip>
      <PanelTooltipTrigger render={<PanelInline truncate size={size} tone={tone} mono={mono}>{text}</PanelInline>} />
      <PanelTooltipContent>{text}</PanelTooltipContent>
    </PanelTooltip>
  );
}

type DetailRowProps = {
  label: string;
  value: string;
};

export function DetailRow({ label, value }: DetailRowProps) {
  return (
    <PanelMetaGrid>
      <PanelInline tone="muted" size="sm">{label}</PanelInline>
      <SingleLineTooltipText text={value} size="sm" />
    </PanelMetaGrid>
  );
}
