/**
 * The charger's week as the schedule will actually run it: what is in force
 * at every minute of every day. Pure — the Charge Manager's week strip draws it.
 *
 * Each schedule event holds until the next one, wrapping round the week, so
 * the gaps between rules belong to whichever event came last (an open-ended
 * rule runs on; a rule's stop event switches charging off until the next
 * start). Reading the events this way is what shows that one overnight rule
 * also means no charging during the day.
 */

import { DAYS, type Timer } from '../schedule/timers'

/** What the schedule does over a stretch of the day. */
export type WeekKind = 'on' | 'eco' | 'off'

export interface WeekSegment {
  /** Minutes from midnight, start inclusive, end exclusive (0–1440). */
  start: number
  end: number
  kind: WeekKind
}

export interface WeekDay {
  day: string
  segments: WeekSegment[]
}

const DAY_MINUTES = 1440

function kindOf(t: Timer): WeekKind {
  if (t.state === 'disabled') return 'off'
  if (t.state === 'eco' || t.feature === 'divert') return 'eco'
  return 'on'
}

function minutesOf(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/** One entry per weekday, Monday first; empty when there are no events. */
export function weekPlan(timers: Timer[] | undefined): WeekDay[] {
  const events: { at: number; kind: WeekKind }[] = []
  for (const t of timers ?? []) {
    for (const day of t.days ?? []) {
      const d = DAYS.indexOf(day)
      if (d >= 0) events.push({ at: d * DAY_MINUTES + minutesOf(t.time), kind: kindOf(t) })
    }
  }
  if (events.length === 0) return []
  events.sort((a, b) => a.at - b.at)

  // Before the week's first event, its last event is still in force.
  let kind = events[events.length - 1].kind
  let next = 0
  return DAYS.map((day, d) => {
    const dayStart = d * DAY_MINUTES
    const segments: WeekSegment[] = []
    let from = 0
    const close = (to: number): void => {
      if (to <= from) return
      const last = segments[segments.length - 1]
      if (last?.kind === kind && last.end === from) last.end = to
      else segments.push({ start: from, end: to, kind })
      from = to
    }
    while (next < events.length && events[next].at < dayStart + DAY_MINUTES) {
      close(events[next].at - dayStart)
      kind = events[next].kind
      next++
    }
    close(DAY_MINUTES)
    return { day, segments }
  })
}

/**
 * Where the charger's clock is in its week: the plan's day and offset (its
 * own time zone, which is the one the schedule runs in), moved on by the time
 * since the plan was fetched. Null without a plan.
 */
export function nowInWeek(
  plan: { current_day: string; current_offset: number } | undefined,
  elapsedMs: number,
): { day: string; minutes: number } | null {
  const d = DAYS.indexOf(plan?.current_day ?? '')
  if (!plan || d < 0) return null
  const total = d * DAY_MINUTES + Math.floor((plan.current_offset + elapsedMs / 1000) / 60)
  const week = total % (7 * DAY_MINUTES)
  return { day: DAYS[Math.floor(week / DAY_MINUTES)], minutes: week % DAY_MINUTES }
}
