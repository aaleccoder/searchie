import { createFileRoute } from '@tanstack/react-router'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import * as React from 'react'
import { LauncherPanel } from '@/components/launcher/launcher-panel'

export const Route = createFileRoute('/')({
  component: Index,
})

function Index() {
  const [launcherExpanded, setLauncherExpanded] = React.useState(false)
  const [openSettingsRequestKey, setOpenSettingsRequestKey] = React.useState(0)

  React.useEffect(() => {
    const syncWindowSize = async () => {
      try {
        const mode = launcherExpanded ? 'launcher' : 'compact'
        await invoke('set_main_window_mode', { mode })
      } catch (error) {
        console.error('[window] Failed to resize main window:', error)
      }
    }

    void syncWindowSize()
  }, [launcherExpanded])

  React.useEffect(() => {
    let unlisten: undefined | (() => void)

    const setup = async () => {
      unlisten = await listen('searchie://open-settings', () => {
        setLauncherExpanded(true)
        setOpenSettingsRequestKey((current) => current + 1)
      })
    }

    void setup()
    return () => {
      unlisten?.()
    }
  }, [])

  return (
    <LauncherPanel
      expanded={launcherExpanded}
      onExpandedChange={setLauncherExpanded}
      onOpenSettings={() => setLauncherExpanded(true)}
      openSettingsRequestKey={openSettingsRequestKey}
    />
  )
}
