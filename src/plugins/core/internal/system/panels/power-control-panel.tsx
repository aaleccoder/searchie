import * as React from "react";
import { Gauge } from "lucide-react";
import { useHotkey } from "@tanstack/react-hotkeys";
import {
  List as PanelList,
  ListItem as PanelListItem,
  PanelContainer,
  PanelFlex,
  PanelText,
  createPluginBackendSdk,
  usePanelEnterBridge,
  usePanelFooter,
  usePanelFooterControlsRef,
} from "@/plugins/sdk";
import type { PanelFooterConfig } from "@/lib/panel-contract";
import { parsePowerProfileCommand, type SystemPowerProfile } from "@/lib/utilities/system-control-engine";
import { systemCommandScope } from "@/plugins/core/internal/system/system-command-scope";

type PowerControlPanelProps = {
  commandQuery: string;
  registerInputEnterHandler?: ((handler: (() => boolean | void) | null) => void) | undefined;
  registerPanelFooter?: ((footer: PanelFooterConfig | null) => void) | undefined;
  focusLauncherInput?: (() => void) | undefined;
};

type PowerRow = {
  id: SystemPowerProfile;
  label: string;
};

const PROFILES: PowerRow[] = [
  { id: "power-saver", label: "Power Saver" },
  { id: "balanced", label: "Balanced" },
  { id: "performance", label: "Performance" },
];

export function PowerControlPanel({
  commandQuery,
  registerInputEnterHandler,
  registerPanelFooter,
}: PowerControlPanelProps) {
  const backend = React.useMemo(() => createPluginBackendSdk(systemCommandScope), []);
  const [selectedIndex, setSelectedIndex] = React.useState(1);
  const [message, setMessage] = React.useState<string>("");
  const lastAppliedQueryRef = React.useRef<string>("");
  const itemRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const { registerFooterControls } = usePanelFooterControlsRef();

  const selectedProfile = PROFILES[selectedIndex] ?? null;

  const applyProfile = React.useCallback(
    async (profile: SystemPowerProfile) => {
      try {
        await backend.system.setPowerProfile(profile);
        const label = PROFILES.find((item) => item.id === profile)?.label ?? profile;
        setMessage(`Power profile set to ${label}.`);
      } catch (error) {
        console.error("[system-power] profile change failed", { profile, error });
        setMessage("Power profile command failed.");
      }
    },
    [backend.system],
  );

  const runSelected = React.useCallback(async () => {
    if (!selectedProfile) {
      return false;
    }

    await applyProfile(selectedProfile.id);
    return true;
  }, [applyProfile, selectedProfile]);

  React.useEffect(() => {
    itemRefs.current[selectedIndex]?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  React.useEffect(() => {
    const normalizedQuery = commandQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      lastAppliedQueryRef.current = "";
      return;
    }

    if (normalizedQuery === lastAppliedQueryRef.current) {
      return;
    }

    const parsed = parsePowerProfileCommand(normalizedQuery);
    if (!parsed) {
      return;
    }

    lastAppliedQueryRef.current = normalizedQuery;

    const nextIndex = PROFILES.findIndex((entry) => entry.id === parsed);
    if (nextIndex >= 0) {
      setSelectedIndex(nextIndex);
      void applyProfile(parsed);
    }
  }, [applyProfile, commandQuery]);

  useHotkey(
    "ArrowDown",
    () => {
      setSelectedIndex((prev) => Math.min(PROFILES.length - 1, prev + 1));
    },
    { preventDefault: true },
  );

  useHotkey(
    "ArrowUp",
    () => {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    },
    { preventDefault: true },
  );

  usePanelEnterBridge(
    registerInputEnterHandler,
    selectedProfile
      ? () => {
          void runSelected();
          return true;
        }
      : null,
  );

  const footerConfig = React.useMemo<PanelFooterConfig | null>(() => {
    if (!selectedProfile) {
      return null;
    }

    return {
      panel: {
        title: "Power",
        icon: Gauge,
      },
      registerControls: registerFooterControls,
      primaryAction: {
        id: selectedProfile.id,
        label: `Apply ${selectedProfile.label}`,
        onSelect: () => {
          void runSelected();
        },
        shortcutHint: "Enter",
      },
    };
  }, [registerFooterControls, runSelected, selectedProfile]);

  usePanelFooter(registerPanelFooter, footerConfig);

  return (
    <PanelContainer padding="md" style={{ height: "100%" }}>
      <PanelFlex direction="col" gap="sm">
        <PanelText size="lg" weight="semibold">
          Power Profile
        </PanelText>
        <PanelText size="xs" tone="muted">
          Use command: saver, balanced, performance.
        </PanelText>
      </PanelFlex>

      <PanelContainer style={{ marginTop: "0.75rem" }}>
        <PanelList gap="sm">
          {PROFILES.map((entry, index) => (
            <PanelListItem
              key={entry.id}
              active={index === selectedIndex}
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              onMouseEnter={() => setSelectedIndex(index)}
              onClick={() => {
                setSelectedIndex(index);
                void applyProfile(entry.id);
              }}
            >
              <PanelText>{entry.label}</PanelText>
            </PanelListItem>
          ))}
        </PanelList>
      </PanelContainer>

      <PanelContainer style={{ marginTop: "0.75rem" }}>
        <PanelText size="xs" tone="muted">
          {message || "No profile applied yet."}
        </PanelText>
      </PanelContainer>
    </PanelContainer>
  );
}
