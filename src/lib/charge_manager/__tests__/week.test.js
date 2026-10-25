import { describe, it, expect } from 'vitest'
import { weekPlan, nowInWeek } from '../week'

const ON = (start, end) => ({ start, end, kind: 'on' })
const OFF = (start, end) => ({ start, end, kind: 'off' })

// The mock's schedule: charge from 23:00 on weekdays, from 09:30 at the
// weekend, and stop at 06:15 on Monday, Wednesday and Friday.
const fixture = [
  { id: 1, state: 'active', time: '23:00', days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] },
  { id: 2, state: 'active', time: '09:30', days: ['saturday', 'sunday'] },
  { id: 3, state: 'disabled', time: '06:15', days: ['monday', 'wednesday', 'friday'] },
]

describe('weekPlan', () => {
  it('has nothing to show without schedule events', () => {
    expect(weekPlan([])).toEqual([])
    expect(weekPlan(undefined)).toEqual([])
  })

  it('lists the seven days Monday first', () => {
    expect(weekPlan(fixture).map((d) => d.day)).toEqual([
      'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
    ])
  })

  it('holds each event until the next one, wrapping round the week', () => {
    const week = weekPlan(fixture)
    // Before Monday 06:15 the last event of the week (Sunday 09:30, charge) still holds.
    expect(week[0].segments).toEqual([ON(0, 375), OFF(375, 1380), ON(1380, 1440)])
    // Monday 23:00 charges straight through Tuesday: one unbroken segment.
    expect(week[1].segments).toEqual([ON(0, 1440)])
    expect(week[2].segments).toEqual([ON(0, 375), OFF(375, 1380), ON(1380, 1440)])
    expect(week[6].segments).toEqual([ON(0, 1440)])
  })

  it('keeps one event in force all week when it is the only one', () => {
    const week = weekPlan([{ id: 1, state: 'disabled', time: '07:00', days: ['tuesday'] }])
    for (const d of week) expect(d.segments).toEqual([OFF(0, 1440)])
  })

  it('shows solar divert windows as eco', () => {
    const week = weekPlan([
      { id: 1, state: 'active', time: '10:00', days: ['monday'], feature: 'divert' },
      { id: 2, state: 'disabled', time: '16:00', days: ['monday'] },
    ])
    expect(week[0].segments).toEqual([OFF(0, 600), { start: 600, end: 960, kind: 'eco' }, OFF(960, 1440)])
  })

  it('reads old-format eco events as eco', () => {
    const week = weekPlan([{ id: 1, state: 'eco', time: '00:00', days: ['monday'] }])
    expect(week[0].segments).toEqual([{ start: 0, end: 1440, kind: 'eco' }])
  })

  it('ignores seconds in event times', () => {
    const week = weekPlan([
      { id: 1, state: 'active', time: '01:00:30', days: ['monday'] },
      { id: 2, state: 'disabled', time: '02:00:00', days: ['monday'] },
    ])
    expect(week[0].segments).toEqual([OFF(0, 60), ON(60, 120), OFF(120, 1440)])
  })
})

describe('nowInWeek', () => {
  const plan = { current_day: 'thursday', current_offset: 64830 } // 18:00:30

  it('reads the charger clock from the plan', () => {
    expect(nowInWeek(plan, 0)).toEqual({ day: 'thursday', minutes: 1080 })
  })

  it('moves on by the time since the plan was fetched', () => {
    expect(nowInWeek(plan, 90 * 60000)).toEqual({ day: 'thursday', minutes: 1170 })
  })

  it('rolls into the next day, and from Sunday back to Monday', () => {
    expect(nowInWeek(plan, 7 * 3600000)).toEqual({ day: 'friday', minutes: 60 })
    expect(nowInWeek({ current_day: 'sunday', current_offset: 86340 }, 120000)).toEqual({ day: 'monday', minutes: 1 })
  })

  it('has no answer without a plan from the charger', () => {
    expect(nowInWeek(undefined, 0)).toBeNull()
    expect(nowInWeek({ current_day: 'someday', current_offset: 0 }, 0)).toBeNull()
  })
})
