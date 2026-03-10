import { createFileRoute } from "@tanstack/react-router";
import { SettingsPanel } from "@/components/settings-panel";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="p-6 max-w-lg mx-auto">
        <SettingsPanel />
      </div>
    </div>
  );
}
