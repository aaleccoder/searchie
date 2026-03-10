import * as React from 'react'
import { Outlet, createRootRoute, useRouter } from '@tanstack/react-router'
import "../App.css"
import { ThemeProvider, useTheme } from '@/components/theme-provider';
import { useSettingsStore } from '@/lib/settings-store';
import { getCurrentWindow } from '@tauri-apps/api/window';

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="searchie-theme">
      <AppInit />
      <Outlet />
    </ThemeProvider>
  )
}

// Loads persisted settings on mount and keeps ThemeProvider in sync.
// If this webview is the "settings" window, immediately navigate to /settings.
function AppInit() {
  const init = useSettingsStore((s) => s.init);
  const theme = useSettingsStore((s) => s.settings.theme);
  const loading = useSettingsStore((s) => s.loading);
  const { setTheme } = useTheme();
  const router = useRouter();
  const label = React.useMemo(() => {
    try {
      return getCurrentWindow().label;
    } catch {
      return "main";
    }
  }, []);

  React.useLayoutEffect(() => {
    const isSettingsPath =
      window.location.pathname === '/settings' || window.location.hash.startsWith('#/settings');

    if (label === 'settings' && !isSettingsPath) {
      router.navigate({ to: '/settings', replace: true });
    }
  }, [label, router]);

  React.useEffect(() => {
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!loading) {
      setTheme(theme);
    }
  }, [theme, loading, setTheme]);

  return null;
}

