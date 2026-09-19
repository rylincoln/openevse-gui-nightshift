/** Pure helpers for the Charge Manager. No store or DOM access — fully unit-tested. */

import { nextTimerId } from '../schedule/timers'
import type { Timer } from '../schedule/timers'
import type { LimitType } from '../api/device'

/** All supported global feature keys, in display order. */
export const GLOBAL_FEATURE_KEYS: string[] = ['session_limit', 'eco_divert', 'shaping', 'rfid', 'ocpp']

/** The `{ type, value }` a Rule carries when a session/energy/time/SOC/range limit is set. */
export interface RuleLimit {
  type: LimitType
  value: number
}

/** The Charge Manager's rule model — a scheduled window or an Always-On global feature. */
export interface Rule {
  id: string | null
  alwaysOn: boolean
  action: string
  days: string[]
  startTime: string
  stopTime: string | null
  chargeCurrent: number | null
  limit: RuleLimit | null
  _startEventId: number | null
  _stopEventId: number | null
}

/**
 * Maps a Rule action to the timer `state` string the firmware expects.
 * EvseState::fromString only recognises 'a'→active and 'd'→disabled, so every
 * feature-enabled action (including 'eco') must use 'active' + the feature field.
 */
export function actionToTimerState(action: string): 'active' | 'disabled' {
  if (action === 'disable') return 'disabled'
  return 'active'
}

/**
 * Maps a Rule action to the firmware `feature` field value.
 * 'eco' is treated as an alias for 'eco_divert' because the firmware has no
 * native Eco EvseState — divert's eco mode is the correct implementation.
 */
function actionToTimerFeature(action: string): string | null {
  const map: Record<string, string> = { eco: 'divert', eco_divert: 'divert', shaper: 'shaper', rfid: 'rfid', ocpp: 'ocpp' }
  return map[action] ?? null
}

/**
 * Maps a Rule action to the global "Always Active" feature key it corresponds
 * to, or null for actions (charge / disable) that have no on/off global feature.
 * Used to keep a feature mutually exclusive between Always-On and Scheduled.
 */
export function actionToFeatureKey(action: string): string | null {
  switch (action) {
    case 'eco_divert': return 'eco_divert'
    case 'shaper':     return 'shaping'
    case 'rfid':       return 'rfid'
    case 'ocpp':       return 'ocpp'
    default:           return null
  }
}

/**
 * Maps a timer `state` + optional `feature` back to a Rule action.
 * `state === 'eco'` handles old-format timers stored before this format change.
 */
export function timerStateToAction(state: string, feature: string | null = null): string {
  if (state === 'disabled') return 'disable'
  if (state === 'eco') return 'eco_divert'   // old-format backward compat
  if (feature === 'divert') return 'eco_divert'
  if (feature === 'shaper') return 'shaper'
  if (feature === 'rfid') return 'rfid'
  if (feature === 'ocpp') return 'ocpp'
  return 'charge'
}

/**
 * Returns true when stopTime wraps past midnight relative to startTime.
 * e.g. start=23:00, stop=01:00 → true (stop is next calendar day).
 */
export function isNextDay(startTime: string | null | undefined, stopTime: string | null | undefined): boolean {
  if (!startTime || !stopTime) return false
  const toMins = (t: string): number => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
  return toMins(stopTime) <= toMins(startTime)
}

/**
 * Shift each day name forward by one calendar day.
 * Used so stop-timer days align correctly when a window wraps past midnight.
 */
function shiftDaysForward(days: string[]): string[] {
  const order = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  return days.map((d) => { const i = order.indexOf(d); return i === -1 ? d : order[(i + 1) % 7] })
}

/**
 * Derive Rule[] from a flat list of backend timer events.
 *
 * Pairing, most deterministic first:
 *  1. Id-adjacency — rulesToTimers writes stopId = startId + 1, so a disabled
 *     timer at A.id + 1 that is also day/time-consistent is A's stop, even
 *     when several stops share the same day set.
 *  2. Same-day heuristic (identical days, later time) for legacy data.
 *  3. Next-day heuristic (days shifted forward one, time at or before the
 *     start — a shifted stop only exists for windows that wrap midnight).
 *  4. Unmatched disabled timers become standalone disable rules.
 *
 * A stop written for a feature rule carries the same feature (feature_value 0)
 * while a charge rule's stop is plain ('current' lives only on the start), so
 * candidates must also match on feature or they belong to another rule.
 */
export function timersToRules(timers: Timer[] | undefined): Rule[] {
  if (!Array.isArray(timers) || timers.length === 0) return []

  const sorted    = [...timers].sort((a, b) => a.time.localeCompare(b.time))
  const actives   = sorted.filter((t) => t.state !== 'disabled')
  const disableds = sorted.filter((t) => t.state === 'disabled')
  const usedIds   = new Set<number>()
  const stopFor   = new Map<number, Timer>() // active timer id → its stop timer
  const rules: Rule[] = []

  const stopFeature = (A: Timer): string | null =>
    A.feature && A.feature !== 'current' ? A.feature : null

  const matchers = (A: Timer) => {
    const daysKey    = daysSetKey(A.days)
    const shiftedKey = daysSetKey(shiftDaysForward(A.days ?? []))
    const feat       = stopFeature(A)
    const usable  = (B: Timer) => !usedIds.has(B.id) && (B.feature ?? null) === feat
    const sameDay = (B: Timer) => daysSetKey(B.days) === daysKey && B.time > A.time
    const nextDay = (B: Timer) => daysSetKey(B.days) === shiftedKey && B.time <= A.time
    return { usable, sameDay, nextDay }
  }

  // Pass 1: resolve every id-adjacent pair first, so a time-sorted neighbour
  // can't steal a stop that provably belongs to another start.
  for (const A of actives) {
    const { usable, sameDay, nextDay } = matchers(A)
    const B = disableds.find((B) => B.id === A.id + 1 && usable(B) && (sameDay(B) || nextDay(B)))
    if (B) { stopFor.set(A.id, B); usedIds.add(B.id) }
  }
  // Passes 2/3: day-set heuristics for legacy pairs with non-adjacent ids.
  for (const A of actives) {
    if (stopFor.has(A.id)) continue
    const { usable, sameDay, nextDay } = matchers(A)
    const B = disableds.find((B) => usable(B) && sameDay(B))
           ?? disableds.find((B) => usable(B) && nextDay(B))
    if (B) { stopFor.set(A.id, B); usedIds.add(B.id) }
  }

  for (const A of actives) {
    const stop = stopFor.get(A.id) ?? null

    const action        = timerStateToAction(A.state, A.feature ?? null)
    const chargeCurrent = A.feature === 'current' ? (A.feature_value ?? null) : null
    const limit: RuleLimit | null =
      A.limit && A.limit !== 'none' && A.limit_value != null ? { type: A.limit, value: A.limit_value } : null
    rules.push({
      id:            `r_${A.id}`,
      alwaysOn:      false,
      days:          A.days ?? [],
      startTime:     A.time,
      stopTime:      stop?.time ?? null,
      action,
      chargeCurrent,
      limit,
      _startEventId: A.id,
      _stopEventId:  stop?.id ?? null,
    })
  }

  // Remaining unmatched disabled timers → standalone disable rules
  for (const B of disableds) {
    if (!usedIds.has(B.id)) {
      rules.push({
        id:            `r_${B.id}`,
        alwaysOn:      false,
        days:          B.days ?? [],
        startTime:     B.time,
        stopTime:      null,
        action:        'disable',
        chargeCurrent: null,
        limit:         null,
        _startEventId: B.id,
        _stopEventId:  null,
      })
    }
  }

  return rules
}

/**
 * Given a rule (new or edited) and the current list of existing timers,
 * return `{ add: Timer[], remove: number[] }` describing what to POST/DELETE.
 *
 * For a new rule: _startEventId and _stopEventId are null — new IDs are assigned.
 * For an edited rule: existing IDs are reused.
 */
export function rulesToTimers(
  rule: Rule,
  existingTimers: Timer[] | undefined,
): { add: Timer[]; remove: number[] } {
  const timers = Array.isArray(existingTimers) ? existingTimers : []
  const add: Timer[] = []
  const remove: number[] = []

  // Determine IDs
  const isNew = rule._startEventId == null
  const startId: number = rule._startEventId ?? nextTimerId(timers)
  let stopId = rule._stopEventId

  // If the rule now has no stop time but previously had a stop event, delete it
  if (!isNew && rule.stopTime == null && stopId != null) {
    remove.push(stopId)
    stopId = null
  }

  // Build start timer
  const feature = actionToTimerFeature(rule.action)
  const limit = rule.limit
  const hasLimit = !!(limit && limit.type && limit.type !== 'none' && limit.value > 0)
  const startTimer: Timer = {
    id: startId,
    time: rule.startTime,
    state: actionToTimerState(rule.action),
    days: rule.days,
    ...(feature
      ? { feature, feature_value: 1 }
      : rule.chargeCurrent !== null && rule.chargeCurrent > 0
        ? { feature: 'current', feature_value: rule.chargeCurrent }
        : {}),
    ...(hasLimit && limit ? { limit: limit.type, limit_value: limit.value } : {}),
  }
  add.push(startTimer)

  // Build stop timer (if stopTime is set)
  if (rule.stopTime) {
    // No existing stop event: prefer the slot right after the start —
    // timersToRules relies on this adjacency to re-pair the events — but
    // never collide with an existing timer id (a rule gaining a stop later).
    if (stopId == null) stopId = Math.max(startId + 1, nextTimerId(timers))
    const stopDays = isNextDay(rule.startTime, rule.stopTime)
      ? shiftDaysForward(rule.days)
      : rule.days
    add.push({
      id: stopId,
      time: rule.stopTime,
      state: 'disabled',
      days: stopDays,
      ...(feature ? { feature, feature_value: 0 } : {}),
    })
  }

  return { add, remove }
}

/**
 * IDs to DELETE when a rule is removed entirely.
 */
export function ruleDeleteIds(rule: Rule): number[] {
  const ids: number[] = []
  if (rule._startEventId != null) ids.push(rule._startEventId)
  if (rule._stopEventId != null) ids.push(rule._stopEventId)
  return ids
}

/**
 * Stable key for comparing two days arrays as sets (order-independent).
 */
function daysSetKey(days: string[] | undefined): string {
  if (!Array.isArray(days)) return ''
  return [...days].sort().join(',')
}

/**
 * Format a window time string: "1:00 PM – 6:00 PM", "from 1:00 PM", or with "(next day)" suffix.
 */
export function formatWindow(startTime: string, stopTime: string | null | undefined): string {
  const fmt = (t: string | null): string => {
    if (!t) return ''
    const [h, m] = t.split(':').map(Number)
    const period = h >= 12 ? 'PM' : 'AM'
    const h12 = h % 12 || 12
    return `${h12}:${String(m).padStart(2, '0')} ${period}`
  }
  if (stopTime) {
    const nextDay = isNextDay(startTime, stopTime)
    return `${fmt(startTime)} – ${fmt(stopTime)}${nextDay ? ' (next day)' : ''}`
  }
  return `from ${fmt(startTime)}`
}
