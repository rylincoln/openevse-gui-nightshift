import { SETTINGS_PAGES } from './config/pages'

// Each screen's name by route; a sub-route shares its screen's.
const SCREENS: Record<string, string> = {
  '/schedule': 'nav.charge_manager',
  '/schedule/legacy': 'screen.schedule',
  '/monitoring': 'nav.monitoring',
  '/monitoring/health': 'nav.monitoring',
  '/history': 'nav.history',
  '/settings': 'nav.settings',
}

/**
 * The document title for a route: the screen, then the charger's name, so
 * tabs, history and a screen reader's window list tell screens apart. Home
 * is the charger's name alone.
 */
export function pageTitle(path: string, deviceName: string, t: (key: string) => string): string {
  if (path === '/') return deviceName
  const key =
    SCREENS[path] ??
    SETTINGS_PAGES.find((p) => p.route === path)?.labelKey ??
    'screen.notfound'
  return `${t(key)} – ${deviceName}`
}
