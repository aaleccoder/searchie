import {
  Bluetooth,
  Gauge,
  MonitorUp,
  Music2,
  Plane,
  Radio,
  Settings2,
  Volume2,
  Wifi,
  Zap,
} from "lucide-react";
import { parseBrightnessCommand, parseConnectivityCommand, type ConnectivityTarget } from "@/lib/utilities/system-control-engine";
import type { ShortcutCommandDescriptor, ShortcutPanelDescriptor } from "@/lib/panel-contract";
import { createPrefixAliasMatcher } from "@/lib/panel-matchers";
import { createPluginBackendSdk, definePluginCommand, definePluginPanel } from "@/plugins/sdk";
import {
  AIRPLANE_ALIAS_LIST,
  BLUETOOTH_ALIAS_LIST,
  BRIGHTNESS_ALIAS_LIST,
  HOTSPOT_ALIAS_LIST,
  MEDIA_ALIAS_LIST,
  POWER_ALIAS_LIST,
  SYSTEM_SETTINGS_ALIAS_LIST,
  VOLUME_ALIAS_LIST,
  WIFI_ALIAS_LIST,
} from "./system-control-aliases";
import { systemCommandScope } from "./system-command-scope";
import { BrightnessControlPanel } from "./panels/brightness-control-panel";
import { ConnectivityControlPanel } from "./panels/connectivity-control-panel";
import { PowerControlPanel } from "./panels/power-control-panel";
import { SystemSettingsPanel } from "./panels/system-settings-panel";
import { VolumeControlPanel } from "./panels/volume-control-panel";

const systemBackend = createPluginBackendSdk(systemCommandScope);

function makeResultPanel(descriptor: ShortcutPanelDescriptor): ShortcutPanelDescriptor {
  return definePluginPanel({
    ...descriptor,
    searchIntegration: {
      activationMode: "result-item",
      exitOnEscape: true,
      ...descriptor.searchIntegration,
    },
    appsLauncherIntegration: {
      injectAsApp: true,
      ...descriptor.appsLauncherIntegration,
    },
  });
}

function createVolumePanel(): ShortcutPanelDescriptor {
  return makeResultPanel({
    id: "system-volume",
    name: "Volume",
    aliases: VOLUME_ALIAS_LIST,
    commandIcon: Volume2,
    capabilities: ["system.volume", "system.settings"],
    priority: 32,
    searchIntegration: {
      placeholder: "Volume controls...",
    },
    shortcuts: [
      { keys: "ArrowLeft/ArrowRight", description: "Decrease/increase volume" },
      { keys: "Enter", description: "Apply command or set value" },
      { keys: "M", description: "Toggle mute" },
    ],
    matcher: createPrefixAliasMatcher(VOLUME_ALIAS_LIST),
    component: ({ commandQuery, registerInputEnterHandler, registerPanelFooter }) => (
      <VolumeControlPanel
        commandQuery={commandQuery}
        registerInputEnterHandler={registerInputEnterHandler}
        registerPanelFooter={registerPanelFooter}
      />
    ),
  });
}

function createBrightnessPanel(): ShortcutPanelDescriptor {
  return makeResultPanel({
    id: "system-brightness",
    name: "Brightness",
    aliases: BRIGHTNESS_ALIAS_LIST,
    commandIcon: MonitorUp,
    capabilities: ["system.brightness", "system.settings"],
    priority: 33,
    searchIntegration: {
      placeholder: "Brightness controls...",
    },
    shortcuts: [
      { keys: "ArrowLeft/ArrowRight", description: "Decrease/increase brightness" },
      { keys: "Enter", description: "Apply command or set value" },
    ],
    matcher: createPrefixAliasMatcher(BRIGHTNESS_ALIAS_LIST),
    component: ({ commandQuery, registerInputEnterHandler, registerPanelFooter }) => (
      <BrightnessControlPanel
        commandQuery={commandQuery}
        registerInputEnterHandler={registerInputEnterHandler}
        registerPanelFooter={registerPanelFooter}
      />
    ),
  });
}

function createBrightnessActionMatcher(): ShortcutCommandDescriptor["matcher"] {
  const aliasMatcher = createPrefixAliasMatcher(BRIGHTNESS_ALIAS_LIST);

  return (query) => {
    const match = aliasMatcher(query);
    if (!match.matches) {
      return match;
    }

    return parseBrightnessCommand(match.commandQuery)
      ? match
      : { matches: false, commandQuery: "" };
  };
}

function formatBrightnessActionLabel(commandQuery: string): string {
  const parsed = parseBrightnessCommand(commandQuery);
  if (!parsed) {
    return "Brightness";
  }

  if (parsed.kind === "set") {
    return `Set Brightness to ${parsed.value}%`;
  }

  return parsed.delta > 0 ? "Brightness Up" : "Brightness Down";
}

function createBrightnessActionCommand(): ShortcutCommandDescriptor {
  return definePluginCommand({
    id: "system-brightness-action",
    name: "Brightness",
    aliases: BRIGHTNESS_ALIAS_LIST,
    commandIcon: Zap,
    capabilities: ["system.brightness"],
    priority: 44,
    appsLauncherIntegration: {
      injectAsApp: true,
    },
    matcher: createBrightnessActionMatcher(),
    getLabel: ({ commandQuery }) => formatBrightnessActionLabel(commandQuery),
    execute: async ({ commandQuery }) => {
      const parsed = parseBrightnessCommand(commandQuery);
      if (!parsed) {
        return;
      }

      if (parsed.kind === "set") {
        await systemBackend.system.setBrightness(parsed.value);
        return;
      }

      await systemBackend.system.changeBrightness(parsed.delta);
    },
  });
}

function createConnectivityActionMatcher(
  aliases: string[],
  target: ConnectivityTarget,
): ShortcutCommandDescriptor["matcher"] {
  const aliasMatcher = createPrefixAliasMatcher(aliases);

  return (query) => {
    const match = aliasMatcher(query);
    if (!match.matches) {
      return match;
    }

    return parseConnectivityCommand(target, match.commandQuery)
      ? match
      : { matches: false, commandQuery: "" };
  };
}

function formatConnectivityActionLabel(target: ConnectivityTarget, commandQuery: string): string {
  const parsed = parseConnectivityCommand(target, commandQuery);
  if (!parsed) {
    return target === "hotspot" ? "Mobile Hotspot" : target.charAt(0).toUpperCase() + target.slice(1);
  }

  const name = target === "hotspot" ? "Mobile Hotspot" : target.charAt(0).toUpperCase() + target.slice(1);

  if (parsed.action === "toggle") {
    return `Toggle ${name}`;
  }

  return `${name} ${parsed.value ? "On" : "Off"}`;
}

function createConnectivityActionCommand(args: {
  id: string;
  name: string;
  aliases: string[];
  target: ConnectivityTarget;
  icon: ShortcutCommandDescriptor["commandIcon"];
  capability: ShortcutCommandDescriptor["capabilities"][number];
  priority: number;
}): ShortcutCommandDescriptor {
  return definePluginCommand({
    id: args.id,
    name: args.name,
    aliases: args.aliases,
    commandIcon: args.icon,
    capabilities: [args.capability],
    priority: args.priority,
    appsLauncherIntegration: {
      injectAsApp: true,
    },
    matcher: createConnectivityActionMatcher(args.aliases, args.target),
    getLabel: ({ commandQuery }) => formatConnectivityActionLabel(args.target, commandQuery),
    execute: async ({ commandQuery }) => {
      const parsed = parseConnectivityCommand(args.target, commandQuery);
      if (!parsed) {
        return;
      }

      if (parsed.action === "toggle") {
        if (args.target === "wifi") {
          await systemBackend.system.toggleWifi();
        } else if (args.target === "bluetooth") {
          await systemBackend.system.toggleBluetooth();
        } else if (args.target === "airplane") {
          await systemBackend.system.toggleAirplaneMode();
        } else {
          await systemBackend.system.toggleHotspot();
        }
        return;
      }

      if (args.target === "wifi") {
        await systemBackend.system.setWifiEnabled(parsed.value);
      } else if (args.target === "bluetooth") {
        await systemBackend.system.setBluetoothEnabled(parsed.value);
      } else if (args.target === "airplane") {
        await systemBackend.system.setAirplaneMode(parsed.value);
      } else {
        await systemBackend.system.setHotspotEnabled(parsed.value);
      }
    },
  });
}

type MediaIntent = { action: "play-pause" | "next" | "previous" };

function parseMediaCommand(rawCommandQuery: string): MediaIntent | null {
  const command = rawCommandQuery.trim().toLowerCase();
  if (!command) {
    return null;
  }

  if (["play", "pause", "toggle", "playpause"].includes(command)) {
    return { action: "play-pause" };
  }

  if (["next", "skip"].includes(command)) {
    return { action: "next" };
  }

  if (["previous", "prev", "back"].includes(command)) {
    return { action: "previous" };
  }

  return null;
}

function createMediaActionMatcher(): ShortcutCommandDescriptor["matcher"] {
  const aliasMatcher = createPrefixAliasMatcher(MEDIA_ALIAS_LIST);

  return (query) => {
    const match = aliasMatcher(query);
    if (!match.matches) {
      return match;
    }

    return parseMediaCommand(match.commandQuery)
      ? match
      : { matches: false, commandQuery: "" };
  };
}

function formatMediaActionLabel(commandQuery: string): string {
  const parsed = parseMediaCommand(commandQuery);
  if (!parsed) {
    return "Media Controls";
  }

  if (parsed.action === "play-pause") {
    return "Play/Pause";
  }

  if (parsed.action === "next") {
    return "Next Track";
  }

  return "Previous Track";
}

function createMediaActionCommand(): ShortcutCommandDescriptor {
  return definePluginCommand({
    id: "system-media-action",
    name: "Media Controls",
    aliases: MEDIA_ALIAS_LIST,
    commandIcon: Music2,
    capabilities: ["system.media"],
    priority: 43,
    appsLauncherIntegration: {
      injectAsApp: true,
    },
    matcher: createMediaActionMatcher(),
    getLabel: ({ commandQuery }) => formatMediaActionLabel(commandQuery),
    execute: async ({ commandQuery }) => {
      const parsed = parseMediaCommand(commandQuery);
      if (!parsed) {
        return;
      }

      if (parsed.action === "play-pause") {
        await systemBackend.system.mediaPlayPause();
      } else if (parsed.action === "next") {
        await systemBackend.system.mediaNext();
      } else {
        await systemBackend.system.mediaPrevious();
      }
    },
  });
}

function createConnectivityPanel(args: {
  id: string;
  name: string;
  aliases: string[];
  target: "wifi" | "bluetooth" | "airplane" | "hotspot";
  icon: ShortcutPanelDescriptor["commandIcon"];
  capability: ShortcutPanelDescriptor["capabilities"][number];
  priority: number;
  settingsUri: string;
}): ShortcutPanelDescriptor {
  return makeResultPanel({
    id: args.id,
    name: args.name,
    aliases: args.aliases,
    commandIcon: args.icon,
    capabilities: [args.capability, "system.settings"],
    priority: args.priority,
    searchIntegration: {
      placeholder: `${args.name} controls...`,
    },
    shortcuts: [
      { keys: "ArrowUp/ArrowDown", description: "Select action" },
      { keys: "Enter", description: "Apply action" },
    ],
    matcher: createPrefixAliasMatcher(args.aliases),
    component: ({ commandQuery, registerInputEnterHandler, registerPanelFooter }) => (
      <ConnectivityControlPanel
        title={args.name}
        target={args.target}
        settingsUri={args.settingsUri}
        commandQuery={commandQuery}
        registerInputEnterHandler={registerInputEnterHandler}
        registerPanelFooter={registerPanelFooter}
      />
    ),
  });
}

function createPowerPanel(): ShortcutPanelDescriptor {
  return makeResultPanel({
    id: "system-power",
    name: "Power Profile",
    aliases: POWER_ALIAS_LIST,
    commandIcon: Gauge,
    capabilities: ["system.power", "system.settings"],
    priority: 38,
    searchIntegration: {
      placeholder: "Power profile controls...",
    },
    shortcuts: [
      { keys: "ArrowUp/ArrowDown", description: "Select profile" },
      { keys: "Enter", description: "Apply profile" },
    ],
    matcher: createPrefixAliasMatcher(POWER_ALIAS_LIST),
    component: ({ commandQuery, registerInputEnterHandler, registerPanelFooter }) => (
      <PowerControlPanel
        commandQuery={commandQuery}
        registerInputEnterHandler={registerInputEnterHandler}
        registerPanelFooter={registerPanelFooter}
      />
    ),
  });
}

function createSystemSettingsPanel(): ShortcutPanelDescriptor {
  return makeResultPanel({
    id: "system-settings-shortcuts",
    name: "System Settings",
    aliases: SYSTEM_SETTINGS_ALIAS_LIST,
    commandIcon: Settings2,
    capabilities: ["system.settings"],
    priority: 39,
    searchIntegration: {
      placeholder: "Open system settings shortcuts...",
    },
    shortcuts: [{ keys: "Enter", description: "Open selected settings page" }],
    matcher: createPrefixAliasMatcher(SYSTEM_SETTINGS_ALIAS_LIST),
    component: ({ commandQuery, registerInputEnterHandler, registerPanelFooter }) => (
      <SystemSettingsPanel
        commandQuery={commandQuery}
        registerInputEnterHandler={registerInputEnterHandler}
        registerPanelFooter={registerPanelFooter}
      />
    ),
  });
}

export function buildSystemControlPanels(): ShortcutPanelDescriptor[] {
  return [
    createVolumePanel(),
    createBrightnessPanel(),
    createConnectivityPanel({
      id: "system-wifi",
      name: "Wi-Fi",
      aliases: WIFI_ALIAS_LIST,
      target: "wifi",
      icon: Wifi,
      capability: "system.wifi",
      priority: 34,
      settingsUri: "ms-settings:network-wifi",
    }),
    createConnectivityPanel({
      id: "system-bluetooth",
      name: "Bluetooth",
      aliases: BLUETOOTH_ALIAS_LIST,
      target: "bluetooth",
      icon: Bluetooth,
      capability: "system.bluetooth",
      priority: 35,
      settingsUri: "ms-settings:bluetooth",
    }),
    createConnectivityPanel({
      id: "system-airplane",
      name: "Airplane Mode",
      aliases: AIRPLANE_ALIAS_LIST,
      target: "airplane",
      icon: Plane,
      capability: "system.airplane",
      priority: 36,
      settingsUri: "ms-settings:network-airplanemode",
    }),
    createConnectivityPanel({
      id: "system-hotspot",
      name: "Mobile Hotspot",
      aliases: HOTSPOT_ALIAS_LIST,
      target: "hotspot",
      icon: Radio,
      capability: "system.hotspot",
      priority: 37,
      settingsUri: "ms-settings:network-mobilehotspot",
    }),
    createPowerPanel(),
    createSystemSettingsPanel(),
  ];
}

export function buildSystemDirectCommands(): ShortcutCommandDescriptor[] {
  return [
    createMediaActionCommand(),
    createBrightnessActionCommand(),
    createConnectivityActionCommand({
      id: "system-wifi-action",
      name: "Wi-Fi",
      aliases: WIFI_ALIAS_LIST,
      target: "wifi",
      icon: Wifi,
      capability: "system.wifi",
      priority: 45,
    }),
    createConnectivityActionCommand({
      id: "system-bluetooth-action",
      name: "Bluetooth",
      aliases: BLUETOOTH_ALIAS_LIST,
      target: "bluetooth",
      icon: Bluetooth,
      capability: "system.bluetooth",
      priority: 46,
    }),
    createConnectivityActionCommand({
      id: "system-airplane-action",
      name: "Airplane Mode",
      aliases: AIRPLANE_ALIAS_LIST,
      target: "airplane",
      icon: Plane,
      capability: "system.airplane",
      priority: 47,
    }),
    createConnectivityActionCommand({
      id: "system-hotspot-action",
      name: "Mobile Hotspot",
      aliases: HOTSPOT_ALIAS_LIST,
      target: "hotspot",
      icon: Radio,
      capability: "system.hotspot",
      priority: 48,
    }),
  ];
}
