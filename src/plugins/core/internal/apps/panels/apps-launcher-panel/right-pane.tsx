import { ArrowLeft } from "lucide-react";
import {
  PanelAside,
  PanelButton,
  PanelContainer,
  PanelFlex,
  PanelInline,
  PanelParagraph,
} from "@/components/framework/panel-primitives";
import type { NavigationItem } from "./types";
import { DetailRow, SingleLineTooltipText } from "./ui";

type RightPaneProps = {
  selectedItem: NavigationItem | null;
  selectFirstAppItem: () => boolean;
};

export function RightPane({ selectedItem, selectFirstAppItem }: RightPaneProps) {
  const selectedApp = selectedItem?.kind === "app" ? selectedItem.app : null;

  return (
    <PanelAside>
      {selectedItem?.kind === "panel-command" ? (
        <PanelFlex direction="col" justify="between" gap="sm" style={{ height: "100%" }}>
          <PanelContainer>
            <PanelParagraph size="sm" tone="muted">Press Enter to open {selectedItem.command.panel.name}.</PanelParagraph>
          </PanelContainer>
          <PanelButton
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              selectFirstAppItem();
            }}
          >
            <PanelInline>
              <ArrowLeft size={14} />
              Back to Apps
            </PanelInline>
            <PanelInline size="xs" tone="muted" mono>Left Arrow</PanelInline>
          </PanelButton>
        </PanelFlex>
      ) : selectedItem?.kind === "direct-command" ? (
        <PanelFlex direction="col" justify="between" gap="sm" style={{ height: "100%" }}>
          <PanelContainer>
            <PanelParagraph size="sm" tone="muted">Press Enter to run {selectedItem.command.label}.</PanelParagraph>
          </PanelContainer>
          <PanelButton
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              selectFirstAppItem();
            }}
          >
            <PanelInline>
              <ArrowLeft size={14} />
              Back to Apps
            </PanelInline>
            <PanelInline size="xs" tone="muted" mono>Left Arrow</PanelInline>
          </PanelButton>
        </PanelFlex>
      ) : selectedApp ? (
        <PanelFlex direction="col" gap="md">
          <PanelContainer>
            <PanelParagraph size="xs" tone="muted">Selected App</PanelParagraph>
            <SingleLineTooltipText text={selectedApp.name} size="xl" />
            <SingleLineTooltipText text={selectedApp.launchPath} size="xs" tone="muted" />
          </PanelContainer>

          <PanelFlex direction="col" gap="sm">
            <DetailRow label="Publisher" value={selectedApp.publisher ?? "Unknown"} />
            <DetailRow label="Version" value={selectedApp.version ?? "-"} />
            <DetailRow label="Source" value={selectedApp.source} />
            <DetailRow label="Install Path" value={selectedApp.installLocation ?? "-"} />
          </PanelFlex>

          <PanelFlex direction="col" gap="sm">
            <PanelFlex align="center" justify="between">
              <PanelInline>List to Actions</PanelInline>
              <PanelInline mono>Right Arrow</PanelInline>
            </PanelFlex>
            <PanelFlex align="center" justify="between">
              <PanelInline>Actions to List</PanelInline>
              <PanelInline mono>Left Arrow</PanelInline>
            </PanelFlex>
            <PanelFlex align="center" justify="between">
              <PanelInline>Navigate / Run</PanelInline>
              <PanelInline mono>Up Down + Enter</PanelInline>
            </PanelFlex>
          </PanelFlex>
        </PanelFlex>
      ) : (
        <PanelContainer style={{ height: "100%", display: "grid", placeItems: "center" }}>
          <PanelParagraph tone="muted">No apps found.</PanelParagraph>
        </PanelContainer>
      )}
    </PanelAside>
  );
}
