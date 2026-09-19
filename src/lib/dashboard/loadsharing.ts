// src/lib/dashboard/loadsharing.ts
// View-model for the Home page's load-sharing line/card. Pure — no stores,
// DOM or i18n — so every branch is unit-testable.
//
// The firmware has no field that says *why* a member's pilot is what it is
// (openevse_esp32_firmware#1229). What it does have: the shaper / load-sharing
// claim on max_current (the allocation actually applied), `failsafe_active`
// and per-peer `online` / `last_seen` on GET /loadsharing/status, and the
// joined-peer list plus group current total on /status. That is enough to
// tell an allocation from a lost controller, which is the distinction the
// card has to get right.
import { EvseClients } from '../vars'
import type { Status, LoadSharingStatus } from '../api/device'
import type { ConfigState } from '../stores/config'
import type { ClaimsTargetModel } from '../stores/claims_target'

const LIMIT_CLIENTS: number[] = [EvseClients.shaper.id, EvseClients.loadsharing.id]

/** Coerce an untrusted numeric-ish value to a finite number, or null. */
function num(v: unknown): number | null {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** The Home page's load-sharing line/card view-model, or null when load sharing is off. */
export interface LoadSharingView {
  role: 'controller' | 'member' | ''
  state: 'sharing' | 'limited' | 'failsafe'
  limit: number | null
  localMax: number
  pilot: number
  others: number | null
  online: number | null
  groupTotal: number | null
  groupMax: number | null
  controller: string
  safeLimit: number | null
  unreachableFor: number | null
}

/**
 * @param args.config        /config (loadsharing_* keys)
 * @param args.status        /status (pilot, uptime, loadsharing_joined_peers, loadsharing_group_current_total)
 * @param args.claimsTarget  /claims/target
 * @param args.lsStatus      GET /loadsharing/status, or null when not fetched yet
 * @param args.localMax      this charger's own ceiling (soft max), amps
 */
export function loadSharingView({
  config,
  status,
  claimsTarget,
  lsStatus,
  localMax,
}: {
  config: ConfigState | undefined
  status: Status | undefined
  claimsTarget: ClaimsTargetModel | undefined
  lsStatus: LoadSharingStatus | null | undefined
  localMax: number | undefined
}): LoadSharingView | null {
  const c: Partial<ConfigState> = config ?? {}
  if (!c.loadsharing_enabled) return null
  const s: Partial<Status> = status ?? {}
  const role = c.loadsharing_role === 'controller' || c.loadsharing_role === 'member' ? c.loadsharing_role : ''
  const controller = c.loadsharing_controller_host ?? ''

  // This charger's own ceiling. The dashboard's maxAmps is min(soft, hard),
  // and a firmware that reports max_current_hard as 0 (unset) drags that to
  // 0 — so fall back through the soft max and the live max before giving
  // up. With no ceiling at all, any allocation counts as a limit.
  const localMaxNum = num(localMax)
  const softMaxNum = num(c.max_current_soft)
  const liveMaxNum = num(s.max_current)
  const ceiling =
    localMaxNum !== null && localMaxNum > 0 ? localMaxNum
    : softMaxNum !== null && softMaxNum > 0 ? softMaxNum
    : liveMaxNum !== null && liveMaxNum > 0 ? liveMaxNum
    : null

  // The allocation the group actually imposed: the shaper/load-sharing claim
  // on max_current. Anything else claiming max_current is not load sharing.
  const claimedMaxCurrent = claimsTarget?.claims?.max_current
  const claimed = claimedMaxCurrent != null && LIMIT_CLIENTS.includes(claimedMaxCurrent)
  const applied = claimed ? num(claimsTarget?.properties?.max_current) : null
  const limit = applied !== null && applied >= 0 && (ceiling === null || applied < ceiling) ? applied : null

  // Failsafe is the firmware's own verdict (heartbeat timeout on a member),
  // never inferred from the claim — the claim looks identical either way.
  const failsafe = role === 'member' && lsStatus?.failsafe_active === true

  // Joined peers on /status include this charger; "sharing with N" counts
  // the others. The controller's online count is the fallback.
  const joined = Array.isArray(s.loadsharing_joined_peers) ? s.loadsharing_joined_peers.length : null
  const online = num(lsStatus?.online_count)
  const others = joined !== null ? Math.max(0, joined - 1) : online

  // Seconds since the controller last answered. last_seen is the peer
  // poller's millis()-based stamp in seconds, so it is on the same clock as
  // /status uptime; 0 / absent means it has not answered since startup.
  const peers = lsStatus?.peers
  const peer = Array.isArray(peers) ? peers.find((p) => p && (p.host === controller || p.hostname === controller)) : null
  const lastSeen = num(peer?.last_seen)
  const uptime = num(s.uptime)
  const unreachableFor =
    lastSeen !== null && lastSeen > 0 && uptime !== null && uptime >= lastSeen ? uptime - lastSeen : null

  // amp-scaled like /status `amp` (milliamps).
  const groupTotalRaw = num(s.loadsharing_group_current_total)
  const groupTotal = groupTotalRaw !== null ? Math.round(groupTotalRaw / 100) / 10 : null

  return {
    role,
    state: failsafe ? 'failsafe' : limit !== null ? 'limited' : 'sharing',
    limit,
    localMax: ceiling ?? limit ?? num(s.pilot) ?? 0,
    pilot: num(s.pilot) ?? 0,
    others,
    online,
    groupTotal,
    groupMax: num(c.loadsharing_group_max_current),
    controller,
    safeLimit: num(c.loadsharing_failsafe_safe_current),
    unreachableFor,
  }
}
