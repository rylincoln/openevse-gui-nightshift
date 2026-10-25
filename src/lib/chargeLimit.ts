/**
 * The charge limit: a target (charging time, session energy, state of charge
 * or range) that stops charging when it is reached. The charger holds one at
 * a time, of one of two kinds:
 *
 *  - a User limit, set from the dashboard. It clears at unplug.
 *  - the Default limit, set in the Charge Manager as config
 *    limit_default_type / limit_default_value. The firmware applies it when
 *    that config is written and at boot, and /limit reports it with
 *    auto_release: false — its only marker.
 *
 * A Default limit is never DELETEd: the firmware would not apply it again
 * until the next boot or config write, so the configured limit would be gone
 * while the config still names it. A User limit may replace it.
 *
 * Here: which limit is active and of which kind, setting and clearing each
 * kind in the order the firmware needs, the dashboard knob's percent ↔ range
 * arithmetic, and the target's wording. Callers hand in a small charger seam.
 * No stores, no DOM.
 */
import type { Config, Limit, LimitType } from './api/device'
import { socCeiling } from './dashboard/soc'
import { fmtDur, sec2time } from './utils'

export type LimitTarget = Exclude<LimitType, 'none'>

export interface ChargeLimit {
  type: LimitTarget
  value: number
  /** The Default limit (config limit_default_*) rather than a User limit. */
  isDefault: boolean
}

/**
 * The charger seam: the device writes a limit change is made of. Each
 * resolves true once the charger has accepted the write.
 */
export interface ChargeLimitCharger {
  /** POST /limit */
  setLimit(limit: Limit): Promise<boolean>
  /** DELETE /limit */
  clearLimit(): Promise<boolean>
  /** POST /config */
  saveConfig(data: Partial<Config>): Promise<boolean>
}

/**
 * What a User limit write came to. 'kept': the Default limit stays in place
 * of the clear that was asked for, so the editor goes back to showing it.
 */
export type LimitWrite = 'done' | 'kept' | 'failed'

/** The limit the charger holds, or null when there is none. */
export function readChargeLimit(l: Limit | null | undefined): ChargeLimit | null {
  if (!l || !l.type || l.type === 'none') return null
  return { type: l.type, value: l.value, isDefault: l.auto_release === false }
}

const done = (ok: boolean): LimitWrite => (ok ? 'done' : 'failed')

/** Set a User limit, or clear it with null. A clear leaves a Default limit in place. */
export async function setUserLimit(
  next: { type: LimitTarget; value: number } | null,
  active: Limit | null | undefined,
  charger: ChargeLimitCharger,
): Promise<LimitWrite> {
  if (next) return done(await charger.setLimit({ ...next, auto_release: true }))
  if (readChargeLimit(active)?.isDefault) return 'kept'
  return done(await charger.clearLimit())
}

/**
 * The dashboard's SOC knob. It always moves in percent; `unit` is how it
 * reads, and so which kind of limit it sets.
 */
export interface Knob {
  unit: 'percent' | 'range'
  /** The car's estimated range at 100%, null when unknown. */
  maxRange: number | null
  /** The car's own charge limit in percent, null when unknown. */
  vehicleLimit: number | null
}

const onKnob = (l: ChargeLimit | null): boolean => l?.type === 'soc' || l?.type === 'range'

/** Where the knob sits: on a SOC or range limit, else at the car's own limit. */
export function knobPercent(active: Limit | null | undefined, knob: Knob): number {
  const l = readChargeLimit(active)
  if (l?.type === 'soc') return l.value
  // Clamped: a range limit past a shrunken range estimate must not map past
  // 100%, where the knob would clear it on first touch.
  if (l?.type === 'range' && knob.maxRange !== null) return Math.round(Math.min(100, (l.value / knob.maxRange) * 100))
  return socCeiling(knob.vehicleLimit)
}

/**
 * Commit the knob at `pct`. Below the car's own limit it sets a SOC or range
 * User limit, as the knob reads. At or past it the car governs, so it clears
 * a SOC or range limit; a time or energy limit belongs to its own editor and
 * stays.
 */
export async function setKnob(
  pct: number,
  knob: Knob,
  active: Limit | null | undefined,
  charger: ChargeLimitCharger,
): Promise<LimitWrite> {
  if (pct >= socCeiling(knob.vehicleLimit)) {
    return onKnob(readChargeLimit(active)) ? setUserLimit(null, active, charger) : 'done'
  }
  const next: { type: LimitTarget; value: number } =
    knob.unit === 'range' && knob.maxRange !== null
      ? { type: 'range', value: Math.round((pct / 100) * knob.maxRange) }
      : { type: 'soc', value: pct }
  return setUserLimit(next, active, charger)
}

/** Set the Default limit: type and value in one config write, which the firmware applies at once. */
export async function setDefaultLimit(
  target: { type: LimitType; value: number },
  charger: ChargeLimitCharger,
): Promise<boolean> {
  if (target.type === 'none' || !(target.value > 0)) return false
  return charger.saveConfig({ limit_default_type: target.type, limit_default_value: target.value })
}

/**
 * Clear the Default limit: the config first, so the firmware will not apply
 * it again, then the limit it applied. Never the other way round.
 */
export async function clearDefaultLimit(charger: ChargeLimitCharger): Promise<boolean> {
  if (!(await charger.saveConfig({ limit_default_type: 'none' }))) return false
  return charger.clearLimit()
}

type Translate = (key: string) => string

/**
 * A target's value in its own unit: time in seconds as a duration, energy in
 * Wh as kWh, SOC as a percent, range in `rangeUnit` (km or miles, as
 * config.mqtt_vehicle_range_miles says).
 */
export function targetText(type: LimitTarget, value: number, t: Translate, rangeUnit: string): string {
  if (type === 'time') return fmtDur(value)
  if (type === 'energy') return `${(value / 1000).toFixed(1)} ${t('units.kwh')}`
  if (type === 'soc') return `${value}${t('units.percent')}`
  return `${value} ${rangeUnit}`
}

/** The active limit's target, '' when there is none. A limit's time is in minutes. */
export function limitText(l: Limit | null | undefined, t: Translate, rangeUnit: string): string {
  const active = readChargeLimit(l)
  if (!active) return ''
  return targetText(active.type, active.type === 'time' ? active.value * 60 : active.value, t, rangeUnit)
}
