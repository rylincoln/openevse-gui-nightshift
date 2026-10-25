// src/lib/config/pages.ts
// The single source of truth for the Settings page catalogue.
// The hub, the nav, the placeholder route, and tests all read from here.
import type { Config } from '../api/device'

export type Section = 'connectivity' | 'charger' | 'energy' | 'system'

export const SECTIONS: Section[] = ['connectivity', 'charger', 'energy', 'system']

export interface SettingsPage {
  key: string
  route: string
  icon: string
  labelKey: string
  /** One line under the name in the hub saying what the page holds. */
  descKey: string
  section: Section
  /** A `/config` key (or any one of several) that must be present for this page to show. */
  requires?: keyof Config | (keyof Config)[]
  /** Gated on the OpenEVSE Labs switch (config.labs_enabled, stored on the device). */
  labs?: boolean
}

export const SETTINGS_PAGES: SettingsPage[] = [
  // Connectivity
  { key: 'network', route: '/settings/network', icon: 'mdi:wifi', labelKey: 'config.pages.network', descKey: 'config.page_desc.network', section: 'connectivity' },
  { key: 'http', route: '/settings/http', icon: 'mdi:web', labelKey: 'config.pages.http', descKey: 'config.page_desc.http', section: 'connectivity' },
  { key: 'mqtt', route: '/settings/mqtt', icon: 'mdi:transit-connection-variant', labelKey: 'config.pages.mqtt', descKey: 'config.page_desc.mqtt', section: 'connectivity' },
  // Needs firmware with Shelly LNM; `shelly_lnm_addr` is always present (non-empty default) there.
  { key: 'shellylnm', route: '/settings/shellylnm', icon: 'mdi:meter-electric-outline', labelKey: 'config.pages.shellylnm', descKey: 'config.page_desc.shellylnm', section: 'connectivity', requires: 'shelly_lnm_addr' },
  { key: 'ocpp', route: '/settings/ocpp', icon: 'mdi:ev-station', labelKey: 'config.pages.ocpp', descKey: 'config.page_desc.ocpp', section: 'connectivity' },
  // Charger
  { key: 'evse', route: '/settings/evse', icon: 'mdi:car-electric', labelKey: 'config.pages.evse', descKey: 'config.page_desc.evse', section: 'charger' },
  { key: 'safety', route: '/settings/safety', icon: 'mdi:shield-check-outline', labelKey: 'config.pages.safety', descKey: 'config.page_desc.safety', section: 'charger' },
  { key: 'time', route: '/settings/time', icon: 'mdi:clock-outline', labelKey: 'config.pages.time', descKey: 'config.page_desc.time', section: 'charger' },
  { key: 'rfid', route: '/settings/rfid', icon: 'mdi:nfc-variant', labelKey: 'config.pages.rfid', descKey: 'config.page_desc.rfid', section: 'charger' },
  { key: 'vehicle', route: '/settings/vehicle', icon: 'mdi:car', labelKey: 'config.pages.vehicle', descKey: 'config.page_desc.vehicle', section: 'charger' },
  // Energy
  { key: 'solar', route: '/settings/solar', icon: 'mdi:solar-power', labelKey: 'config.pages.solar', descKey: 'config.page_desc.solar', section: 'energy' },
  // Labs-gated: in-development, depends on matching firmware. Hidden from the
  // nav (and its route redirects) until the OpenEVSE Labs switch is on.
  { key: 'loadsharing', route: '/settings/loadsharing', icon: 'mdi:connection', labelKey: 'config.pages.loadsharing', descKey: 'config.page_desc.loadsharing', section: 'energy', labs: true },
  { key: 'shaper', route: '/settings/shaper', icon: 'mdi:chart-bell-curve', labelKey: 'config.pages.shaper', descKey: 'config.page_desc.shaper', section: 'energy' },
  { key: 'emoncms', route: '/settings/emoncms', icon: 'mdi:chart-box-outline', labelKey: 'config.pages.emoncms', descKey: 'config.page_desc.emoncms', section: 'energy' },
  // System
  { key: 'firmware', route: '/settings/firmware', icon: 'mdi:chip', labelKey: 'config.pages.firmware', descKey: 'config.page_desc.firmware', section: 'system' },
  { key: 'certificates', route: '/settings/certificates', icon: 'mdi:certificate', labelKey: 'config.pages.certificates', descKey: 'config.page_desc.certificates', section: 'system' },
  { key: 'terminal', route: '/settings/terminal', icon: 'mdi:console', labelKey: 'config.pages.terminal', descKey: 'config.page_desc.terminal', section: 'system' },
  // Installer-password gated: commissioning controls (hardware current limit,
  // safety checks). The gate is in the page itself.
  { key: 'installer', route: '/settings/installer', icon: 'mdi:wrench', labelKey: 'config.pages.installer', descKey: 'config.page_desc.installer', section: 'system' },
  // Shown for either kind of on-device display. `tft_theme` only appears in
  // /config on LVGL-TFT builds; `lcd_type` appears on every build whose
  // controller might carry the 2-line character LCD (classic V6, JuiceBox v2
  // conversions), which have no TFT at all — so either key is the "has a
  // display" signal, and the page itself gates each section on its own key.
  { key: 'display', route: '/settings/display', icon: 'mdi:monitor', labelKey: 'config.pages.display', descKey: 'config.page_desc.display', section: 'system', requires: ['tft_theme', 'lcd_type'] },
  { key: 'about', route: '/settings/about', icon: 'mdi:information-outline', labelKey: 'config.pages.about', descKey: 'config.page_desc.about', section: 'system' },
]

/** A hub row that leads out of Settings, to where a setting actually lives. */
export interface SettingsLink {
  route: string
  icon: string
  labelKey: string
  descKey: string
  section: Section
}

export const SETTINGS_LINKS: SettingsLink[] = [
  // Owners look for the schedule under Settings; it lives in Charge Manager.
  { route: '/schedule', icon: 'mdi:lightning-bolt-circle', labelKey: 'nav.charge_manager', descKey: 'config.page_desc.charge_manager', section: 'charger' },
]

// `requires` gates on a device-config capability key, or on any one of a list
// of keys; `labs` gates on the OpenEVSE Labs switch (config.labs_enabled,
// stored on the device).
function hasCapability(
  config: Partial<Config> | undefined,
  requires: SettingsPage['requires'],
): boolean {
  if (!requires) return true
  const keys = Array.isArray(requires) ? requires : [requires]
  return !!config && keys.some((k) => config[k])
}

export interface PageGroup {
  section: Section
  pages: SettingsPage[]
}

export function pagesBySection(config: Partial<Config> | undefined): PageGroup[] {
  return SECTIONS.map((section) => ({
    section,
    pages: SETTINGS_PAGES.filter(
      (p) =>
        p.section === section &&
        hasCapability(config, p.requires) &&
        (!p.labs || !!config?.labs_enabled),
    ),
  })).filter((g) => g.pages.length > 0)
}
