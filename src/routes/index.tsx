import { createFileRoute } from '@tanstack/react-router'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import * as React from 'react'
import { LauncherPanel } from '@/components/launcher-panel'
import { SettingsPanel } from '@/components/settings-panel'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export const Route = createFileRoute('/')({
  component: Index,
})

function Index() {
  const [settingsOpen, setSettingsOpen] = React.useState(false)
  const [launcherExpanded, setLauncherExpanded] = React.useState(false)

  React.useEffect(() => {
    const syncWindowSize = async () => {
      try {
        const mode = settingsOpen ? 'settings' : launcherExpanded ? 'launcher' : 'compact'
        await invoke('set_main_window_mode', { mode })
      } catch (error) {
        console.error('[window] Failed to resize main window:', error)
      }
    }

    void syncWindowSize()
  }, [settingsOpen, launcherExpanded])

  React.useEffect(() => {
    let unlisten: undefined | (() => void)

    const setup = async () => {
      unlisten = await listen('searchie://open-settings', () => {
        setSettingsOpen(true)
      })
    }

    void setup()
    return () => {
      unlisten?.()
    }
  }, [])

  return (
    <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
      <LauncherPanel
        expanded={launcherExpanded}
        onExpandedChange={setLauncherExpanded}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <DialogContent className="w-full max-w-190 p-0 overflow-hidden border-border/70 shadow-2xl">
        <div className="bg-[linear-gradient(135deg,hsl(var(--background))_0%,hsl(var(--accent)/0.35)_100%)]">
          <DialogHeader className="px-6 pt-6 pb-2 text-left">
            <DialogTitle className="text-xl">Settings</DialogTitle>
            <DialogDescription>Update app behavior, shortcuts, and appearance.</DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-6 max-h-[70vh] overflow-y-auto">
            <SettingsPanel />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
