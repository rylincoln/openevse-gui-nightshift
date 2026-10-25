/** Who is holding the charge rate down. Pure. */
import type { ClaimsTargetModel } from '../stores/claims_target'
import { clientid2name } from '../utils'

export interface RateCap {
  /** The capped current, in amps. */
  amps: number
  /** EvseClients key of the client setting the cap. */
  client: string
}

/**
 * The firmware advertises the lowest of maximum current, the winning
 * current cap and the charge rate (EvseManager::setTargetState). A cap below
 * the requested rate is what the owner needs named: "Load shaper limits it
 * to 24 A".
 */
export function rateCap(target: ClaimsTargetModel | null | undefined, requested: number): RateCap | null {
  const amps = target?.properties?.max_current
  const client = target?.claims?.max_current
  if (typeof amps !== 'number' || !client || amps >= requested) return null
  return { amps, client: clientid2name(client) }
}
