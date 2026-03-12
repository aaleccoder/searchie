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
} from "lucide-react";
import type { ShortcutPanelDescriptor } from "@/lib/panel-contract";
import { createPrefixAliasMatcher } from "@/lib/panel-matchers";
import { definePluginPanel } from "@/plugins/sdk";
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
import { BrightnessControlPanel } from "./panels/brightness-control-panel";
import { ConnectivityControlPanel } from "./panels/connectivity-control-panel";
import { MediaControlPanel } from "./panels/media-control-panel";
import { PowerControlPanel } from "./panels/power-control-panel";
import { SystemSettingsPanel } from "./panels/system-settings-panel";
import { VolumeControlPanel } from "./panels/volume-control-panel";

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

function createMediaPanel(): ShortcutPanelDescriptor {
  return makeResultPanel({
    id: "system-media",
    name: "Media Controls",
    aliases: MEDIA_ALIAS_LIST,
    commandIcon: Music2,
    capabilities: ["system.media", "system.settings"],
    priority: 31,
    searchIntegration: {
      placeholder: "Media controls...",
    },
    shortcuts: [
      { keys: "ArrowUp/ArrowDown", description: "Select action" },
      { keys: "Enter", description: "Run media action" },
    ],
    matcher: createPrefixAliasMatcher(MEDIA_ALIAS_LIST),
    component: ({ commandQuery, registerInputEnterHandler, registerPanelFooter }) => (
      <MediaControlPanel
        commandQuery={commandQuery}
        registerInputEnterHandler={registerInputEnterHandler}
        registerPanelFooter={registerPanelFooter}
      />
    ),
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
    createMediaPanel(),
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
