/** Pure helpers for the Dashboard. No store or DOM access — fully unit-tested. */
import type { Status, Limit } from '../api/device'
import type { ConfigState } from '../stores/config'
import type { ControlSegment } from './chargeMode'

/**
 * Hard ceiling for the user-configurable energy-limit slider max, in kWh.
 * The slider builds one stop per kWh, so an unbounded value (it comes from
 * localStorage) could create a huge array and a slow O(n) tick scan. The
 * largest EV packs today are ~200 kWh, so 500 is generous headroom while
 * keeping the slider snappy.
 */
export const ENERGY_LIMIT_MAX_KWH = 500

/**
 * Clamp a user-entered energy-slider max to a whole kWh in
 * [1, ENERGY_LIMIT_MAX_KWH]. A 0 / blank / nullish value is treated as
 * "unset" and falls back to the 100 kWh default.
 */
export function clampEnergyMax(kwh: number | null | undefined): number {
  return Math.min(ENERGY_LIMIT_MAX_KWH, Math.max(1, Math.round(kwh || 100)))
}

/** The Dashboard's mapped display states. */
export type DisplayState = 'starting' | 'idle' | 'off' | 'charging' | 'error' | 'sleeping' | 'connected'

/**
 * Map the raw OpenEVSE `state` code to a Dashboard display state.
 *
 * `segment` is the charge mode. Picking Off leaves the device in the same
 * state 254 it would be in if Auto were waiting on a timer, so the charge
 * mode disambiguates: 254 + Off = 'off'; 254 + anything else = 'sleeping'.
 * The same goes for 255: a device configured to pause by disabling
 * (pause_uses_disabled) sits there for a timer or the default state too.
 */
export function displayState(
  status: Status | null | undefined,
  segment: ControlSegment = 'auto',
): DisplayState {
  const s = status?.state
  const off = segment === 'off'
  if (s === undefined || s === 0) return 'starting'
  if (s === 1) return off ? 'off' : 'idle'
  if (s === 3) return 'charging'
  if (s >= 4 && s <= 11) return 'error'
  if (s === 254) return off ? 'off' : 'sleeping'
  if (s === 255) return off ? 'off' : 'sleeping'
  return 'connected' // 2: car plugged in, not charging
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

/** Progress (0..1) toward an active charge limit. */
export function limitProgress(limit: Limit | null | undefined, status: Status | null | undefined): number {
  if (!limit || limit.type === 'none' || !limit.value) return 0
  if (limit.type === 'time') {
    const targetSeconds = limit.value * 60
    return clamp01((status?.session_elapsed ?? 0) / targetSeconds)
  }
  if (limit.type === 'energy') {
    return clamp01((status?.session_energy ?? 0) / limit.value)
  }
  return 0
}

/**
 * Max charge power in watts: max_current × per-phase voltage, tripled on
 * 3-phase. The firmware sums all phases into the reported `power`, so the max
 * must triple too — otherwise the ring overflows and the "kW max" label reads a
 * third of the real ceiling (~3.8 kW instead of ~11 kW). (gui-nightshift#16)
 */
export function maxPowerW(status: Status | null | undefined, config: ConfigState | null | undefined): number {
  const phases = config?.is_threephase ? 3 : 1
  return (config?.max_current_soft ?? 0) * (status?.voltage ?? 0) * phases
}

/** Ring fill (0..1): limit progress when a limit is active, else power vs max power. */
export function ringFill(
  status: Status | null | undefined,
  config: ConfigState | null | undefined,
  limit: Limit | null | undefined,
): number {
  if (limit && limit.type && limit.type !== 'none' && limit.value) {
    return limitProgress(limit, status)
  }
  const maxPower = maxPowerW(status, config)
  if (maxPower <= 0) return 0
  return clamp01((status?.power ?? 0) / maxPower)
}

/**
 * Is a vehicle physically plugged in?
 *
 * The firmware publishes an authoritative `vehicle` flag (1/0) that stays
 * trustworthy through Sleeping and a manual Off — the pilot is held there, so
 * the controller keeps detecting. Only a cold-boot Disabled state can't sense a
 * plug, and there the flag correctly reports 0. Prefer that flag; fall back to
 * the EVSE state code (2 = connected, 3 = charging) when it's absent (older
 * firmware, or before the first status load).
 */
export function vehicleConnected(status: Status | null | undefined): boolean {
  const v = status?.vehicle
  if (v === 1) return true
  if (v === 0) return false
  const s = status?.state
  return s === 2 || s === 3
}
