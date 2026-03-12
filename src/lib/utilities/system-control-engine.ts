export type BrightnessIntent =
  | { kind: "step"; delta: number }
  | { kind: "set"; value: number };

export type VolumeIntent =
  | { kind: "step"; delta: number }
  | { kind: "set"; value: number }
  | { kind: "mute"; value: boolean }
  | { kind: "toggle-mute" };

export type ConnectivityTarget = "wifi" | "bluetooth" | "airplane" | "hotspot";

export type ConnectivityIntent =
  | { action: "set"; target: ConnectivityTarget; value: boolean }
  | { action: "toggle"; target: ConnectivityTarget };

export type SystemPowerProfile = "balanced" | "power-saver" | "performance";

function normalize(input: string): string {
  return input.trim().toLowerCase();
}

export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (value <= 0) {
    return 0;
  }

  if (value >= 100) {
    return 100;
  }

  return Math.round(value);
}

function parsePercentFromTail(input: string): number | null {
  const match = normalize(input).match(/(?:set|to)?\s*(\d{1,3})%?$/);
  if (!match) {
    return null;
  }

  const parsed = Number.parseInt(match[1], 10);
  return Number.isNaN(parsed) ? null : clampPercent(parsed);
}

export function parseBrightnessCommand(rawCommandQuery: string): BrightnessIntent | null {
  const command = normalize(rawCommandQuery);
  if (!command) {
    return null;
  }

  if (command === "up" || command === "+" || command === "increase") {
    return { kind: "step", delta: 10 };
  }

  if (command === "down" || command === "-" || command === "decrease") {
    return { kind: "step", delta: -10 };
  }

  const percent = parsePercentFromTail(command);
  if (percent !== null) {
    return { kind: "set", value: percent };
  }

  return null;
}

export function parseVolumeCommand(rawCommandQuery: string): VolumeIntent | null {
  const command = normalize(rawCommandQuery);
  if (!command) {
    return null;
  }

  if (command === "mute" || command === "off") {
    return { kind: "mute", value: true };
  }

  if (command === "unmute" || command === "on") {
    return { kind: "mute", value: false };
  }

  if (command === "toggle" || command === "toggle-mute") {
    return { kind: "toggle-mute" };
  }

  if (command === "up" || command === "+" || command === "increase") {
    return { kind: "step", delta: 6 };
  }

  if (command === "down" || command === "-" || command === "decrease") {
    return { kind: "step", delta: -6 };
  }

  const percent = parsePercentFromTail(command);
  if (percent !== null) {
    return { kind: "set", value: percent };
  }

  return null;
}

export function parseConnectivityCommand(
  target: ConnectivityTarget,
  rawCommandQuery: string,
): ConnectivityIntent | null {
  const command = normalize(rawCommandQuery);
  if (!command) {
    return null;
  }

  if (["on", "enable", "enabled"].includes(command)) {
    return { action: "set", target, value: true };
  }

  if (["off", "disable", "disabled"].includes(command)) {
    return { action: "set", target, value: false };
  }

  if (command === "toggle") {
    return { action: "toggle", target };
  }

  return null;
}

export function parsePowerProfileCommand(rawCommandQuery: string): SystemPowerProfile | null {
  const command = normalize(rawCommandQuery);

  if (["balanced", "balance"].includes(command)) {
    return "balanced";
  }

  if (["power-saver", "saver", "eco", "battery-saver"].includes(command)) {
    return "power-saver";
  }

  if (["performance", "high", "high-performance"].includes(command)) {
    return "performance";
  }

  return null;
}
