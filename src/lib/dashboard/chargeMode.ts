/**
 * The charge mode: the dashboard's one choice of who drives charging (Off,
 * Auto, Eco or On), read from what the charger reports and changed through a
 * small charger seam. Everything about how the firmware settles claims that
 * the choice depends on lives here, so callers never build an override or
 * order the writes themselves. No stores, no i18n, no DOM.
 */
import { EvseClients } from '../vars'
import { clientid2name } from '../utils'
import type { Limit, Override } from '../api/device'

/** A charge-mode control segment key. */
export type ControlSegment = 'off' | 'auto' | 'eco' | 'on'

/** What the charger reports that the charge mode is read from and written against. */
export interface ChargeModeSnapshot {
  /** GET /claims/target: who owns the state decision, and the state it asks for. */
  claimsTarget: { properties?: { state?: string | null }; claims?: { state?: number | null } } | null | undefined
  /** status.divertmode: 2 while solar divert drives the charge rate, else 1. */
  divertmode: number | undefined
  /** config.divert_enabled: whether solar divert is set up at all. */
  divertEnabled: boolean
  /** The Manual override as GET /override last returned it ({} when none). */
  override: Override | undefined
  limit: Limit | null | undefined
  /** The charge rate when no client sets one: config.max_current_soft. */
  defaultRate: number | undefined
}

export interface ChargeMode {
  segment: ControlSegment
  /** Client key of the owner of the decision, '' when no client claims it. */
  owner: string
  /** Which authority Locks the charge mode, null when the dashboard may change it. */
  locked: 'OCPP' | 'RFID' | null
  /** A charge limit has been reached and holds charging off. */
  limitReached: boolean
}

/**
 * The charger seam: the device writes a charge-mode change is made of. Each
 * resolves true once the charger has accepted the write.
 */
export interface ChargeModeCharger {
  setOverride(override: Override): Promise<boolean>
  clearOverride(): Promise<boolean>
  setDivertMode(divertmode: 1 | 2): Promise<boolean>
  clearLimit(): Promise<boolean>
}

/** Segment keys in display order. Eco only appears when solar divert is set up. */
export function controlSegments(divertEnabled: boolean): ControlSegment[] {
  return divertEnabled ? ['off', 'auto', 'eco', 'on'] : ['off', 'auto', 'on']
}

/** The charge mode the charger is in, who owns the decision, and whether it can be changed. */
export function readChargeMode(s: ChargeModeSnapshot): ChargeMode {
  const owner = s.claimsTarget?.claims?.state
  const ownerState = s.claimsTarget?.properties?.state
  const manual = owner === EvseClients.manual.id
  return {
    segment:
      manual && ownerState === 'active' ? 'on'
      : manual && ownerState === 'disabled' ? 'off'
      : s.divertEnabled && s.divertmode === 2 ? 'eco'
      : 'auto',
    owner: owner ? clientid2name(owner) : '',
    // OCPP and RFID genuinely own the charge. A reached charge limit is the
    // owner's own setting, so it is a reason, not a lock: On clears it.
    locked: owner === EvseClients.ocpp.id ? 'OCPP' : owner === EvseClients.rfid.id ? 'RFID' : null,
    limitReached: owner === EvseClients.limit.id,
  }
}

/**
 * Switch the charge mode. On and Off are a Manual override that does not
 * auto-release: it stays until the owner picks Auto or Eco. Auto and Eco
 * release it, then set divert explicitly so the charger lands on the picked
 * segment whatever divert was doing before. Resolves false at the first
 * write the charger refuses, without making the writes after it.
 */
export async function selectChargeMode(
  segment: ControlSegment,
  s: ChargeModeSnapshot,
  charger: ChargeModeCharger,
): Promise<boolean> {
  if (segment === 'on' || segment === 'off') {
    const set = await charger.setOverride({
      state: segment === 'on' ? 'active' : 'disabled',
      charge_current: s.override?.charge_current ?? s.defaultRate,
      auto_release: false,
    })
    if (!set) return false
    // A reached charge limit outranks the Manual override, so On alone would
    // not resume charging. A Default limit is never cleared from here: the
    // firmware re-applies it only at boot or on a config write, so deleting it
    // would silently discard the configured limit.
    if (segment === 'on' && readChargeMode(s).limitReached && s.limit?.auto_release !== false) {
      return charger.clearLimit()
    }
    return true
  }
  if (s.override && Object.keys(s.override).length > 0) {
    if (!(await charger.clearOverride())) return false
  }
  return charger.setDivertMode(segment === 'eco' ? 2 : 1)
}

/**
 * Set the charge rate on the Manual override, keeping the state it already
 * claims. Going back to the default rate drops the rate from the override,
 * and releases the override when the rate was all it set.
 */
export async function setChargeRate(
  amps: number,
  s: ChargeModeSnapshot,
  charger: ChargeModeCharger,
): Promise<boolean> {
  const current = s.override ?? {}
  if (amps !== s.defaultRate) {
    return charger.setOverride({ ...current, charge_current: amps, auto_release: false })
  }
  if (current.charge_current === undefined) return true
  const { charge_current: _, ...rest } = current
  const claimsMore = Object.keys(rest).some((k) => k !== 'auto_release')
  return claimsMore ? charger.setOverride(rest) : charger.clearOverride()
}
