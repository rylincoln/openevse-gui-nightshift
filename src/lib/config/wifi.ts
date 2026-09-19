// src/lib/config/wifi.ts
// Pure helpers for the WiFi scan list.

/** One entry from `GET /scan`. */
export interface WifiNetwork {
  ssid: string
  rssi?: number
  encryption?: string | number
  secure?: string | number | boolean
}

/** Dedupe a scan result by SSID (keep the strongest), strongest-first. */
export function normalizeNetworks(list: unknown): WifiNetwork[] {
  if (!Array.isArray(list)) return []
  const byssid = new Map<string, WifiNetwork>()
  for (const n of list as WifiNetwork[]) {
    if (!n || !n.ssid) continue
    const existing = byssid.get(n.ssid)
    if (!existing || (n.rssi ?? -999) > (existing.rssi ?? -999)) {
      byssid.set(n.ssid, n)
    }
  }
  return [...byssid.values()].sort((a, b) => (b.rssi ?? -999) - (a.rssi ?? -999))
}

/** An mdi WiFi-strength icon name for a dBm RSSI value. */
export function signalIcon(rssi: number | null | undefined): string {
  if (rssi === undefined || rssi === null) return 'mdi:wifi-strength-outline'
  if (rssi >= -55) return 'mdi:wifi-strength-4'
  if (rssi >= -65) return 'mdi:wifi-strength-3'
  if (rssi >= -75) return 'mdi:wifi-strength-2'
  return 'mdi:wifi-strength-1'
}

/**
 * RSSI (dBm) as a 0-100 quality percentage. Linear over the usable WiFi
 * range: -50 dBm or better = 100%, -100 dBm or worse = 0%.
 */
export function signalPercent(rssi: unknown): number | null {
  if (typeof rssi !== 'number' || !Number.isFinite(rssi)) return null
  return Math.max(0, Math.min(100, 2 * (rssi + 100)))
}

/** Whether a network needs a password. Unknown encryption → assume secured. */
export function isSecured(network: WifiNetwork | null | undefined): boolean {
  const e = network?.encryption ?? network?.secure
  if (e === undefined || e === null) return true
  if (typeof e === 'string') return !/^(none|open)$/i.test(e)
  if (typeof e === 'number') return e !== 0
  return e !== false
}
