import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PanelRegistryProvider, usePluginRegistry } from "@/components/providers/panel-registry-provider";
import { usePanelRegistry } from "@/lib/panel-registry";

function Probe() {
  const registry = usePanelRegistry();
  const match = registry.find("cl test");
  return <div>{match?.panel.id ?? "none"}</div>;
}

describe("PanelRegistryProvider", () => {
  it("registers clipboard panel aliases", () => {
    render(
      <PanelRegistryProvider>
        <Probe />
      </PanelRegistryProvider>,
    );

    expect(screen.getByText("clipboard")).toBeInTheDocument();
  });

  it("registers default core plugins through provider", () => {
    function PluginProbe() {
      const registry = usePanelRegistry();
      const apps = registry.find("apps notepad")?.panel.id ?? "none";
      const files = registry.find("files report")?.panel.id ?? "none";
      const settingsSearch = registry.find("msettings privacy")?.panel.id ?? "none";
      return (
        <>
          <div>{apps}</div>
          <div>{files}</div>
          <div>{settingsSearch}</div>
        </>
      );
    }

    render(
      <PanelRegistryProvider>
        <PluginProbe />
      </PanelRegistryProvider>,
    );

    expect(screen.getByText("apps-launcher")).toBeInTheDocument();
    expect(screen.getByText("utilities-file-search")).toBeInTheDocument();
    expect(screen.getByText("settings-search")).toBeInTheDocument();
  });

  it("exposes plugin settings from plugin registry context", () => {
    function PluginSettingsProbe() {
      const pluginRegistry = usePluginRegistry();
      const settings = pluginRegistry.listPluginSettings();
      return <div>{settings.some((entry) => entry.pluginId === "core.plugin-settings") ? "yes" : "no"}</div>;
    }

    render(
      <PanelRegistryProvider>
        <PluginSettingsProbe />
      </PanelRegistryProvider>,
    );

    expect(screen.getByText("yes")).toBeInTheDocument();
  });
});
