import { describe, expect, it } from "vitest";
import {
  clampPercent,
  parseBrightnessCommand,
  parseConnectivityCommand,
  parsePowerProfileCommand,
  parseVolumeCommand,
} from "@/lib/utilities/system-control-engine";

describe("system-control-engine", () => {
  it("clamps percentage values", () => {
    expect(clampPercent(-10)).toBe(0);
    expect(clampPercent(45)).toBe(45);
    expect(clampPercent(101)).toBe(100);
  });

  it("parses brightness commands", () => {
    expect(parseBrightnessCommand("up")).toEqual({ kind: "step", delta: 10 });
    expect(parseBrightnessCommand("down")).toEqual({ kind: "step", delta: -10 });
    expect(parseBrightnessCommand("87")).toEqual({ kind: "set", value: 87 });
    expect(parseBrightnessCommand("to 130")).toEqual({ kind: "set", value: 100 });
    expect(parseBrightnessCommand("noise")).toBeNull();
  });

  it("parses volume commands", () => {
    expect(parseVolumeCommand("mute")).toEqual({ kind: "mute", value: true });
    expect(parseVolumeCommand("unmute")).toEqual({ kind: "mute", value: false });
    expect(parseVolumeCommand("toggle")).toEqual({ kind: "toggle-mute" });
    expect(parseVolumeCommand("down")).toEqual({ kind: "step", delta: -6 });
    expect(parseVolumeCommand("57")).toEqual({ kind: "set", value: 57 });
    expect(parseVolumeCommand("set 200")).toEqual({ kind: "set", value: 100 });
    expect(parseVolumeCommand("bad input")).toBeNull();
  });

  it("parses connectivity commands", () => {
    expect(parseConnectivityCommand("wifi", "on")).toEqual({ action: "set", target: "wifi", value: true });
    expect(parseConnectivityCommand("bluetooth", "off")).toEqual({
      action: "set",
      target: "bluetooth",
      value: false,
    });
    expect(parseConnectivityCommand("airplane", "toggle")).toEqual({
      action: "toggle",
      target: "airplane",
    });
    expect(parseConnectivityCommand("hotspot", "invalid")).toBeNull();
  });

  it("parses power profile commands", () => {
    expect(parsePowerProfileCommand("balanced")).toBe("balanced");
    expect(parsePowerProfileCommand("saver")).toBe("power-saver");
    expect(parsePowerProfileCommand("performance")).toBe("performance");
    expect(parsePowerProfileCommand("turbo")).toBeNull();
  });
});
