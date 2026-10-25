import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k, opts) => (opts?.values ? k + ':' + JSON.stringify(opts.values) : k)
  t.subscribe = (fn) => { fn(t); return () => {} }
  const locale = { subscribe: (fn) => { fn('en'); return () => {} } }
  return { _: t, locale }
})

import WeekStrip from '../WeekStrip.svelte'
import { weekPlan } from '../../../charge_manager/week'

const week = weekPlan([
  { id: 1, state: 'active', time: '23:00', days: ['monday'] },
  { id: 2, state: 'disabled', time: '06:00', days: ['monday'] },
  { id: 3, state: 'active', time: '10:00', days: ['tuesday'], feature: 'divert' },
  { id: 4, state: 'active', time: '14:00', days: ['tuesday'] },
])

const plain = (s) => s.replace(/\s/g, ' ')

describe('WeekStrip', () => {
  it('draws one row per day', () => {
    const { container } = render(WeekStrip, { week })
    expect(container.querySelectorAll('[data-day]')).toHaveLength(7)
  })

  it('places each stretch of charging by its time of day', () => {
    const { container } = render(WeekStrip, { week })
    const monday = container.querySelector('[data-day="monday"]')
    const on = monday.querySelectorAll('[data-kind="on"]')
    expect(on).toHaveLength(2)
    expect(on[0].style.left).toBe('0%')
    expect(on[0].style.width).toBe('25%') // 00:00–06:00
    expect(on[1].style.left).toBe(`${(1380 / 1440) * 100}%`)
    // Off is the empty track, not a drawn mark.
    expect(monday.querySelector('[data-kind="off"]')).toBeNull()
  })

  it('draws solar-only stretches differently, and keys them in the legend', () => {
    const { container, getByText } = render(WeekStrip, { week })
    expect(container.querySelector('[data-day="tuesday"] [data-kind="eco"]')).not.toBeNull()
    expect(getByText('charge_manager.week.eco')).toBeInTheDocument()
  })

  it('leaves solar out of the legend when no rule uses it', () => {
    const { queryByText, getByText } = render(WeekStrip, { week: weekPlan([{ id: 1, state: 'active', time: '01:00', days: ['monday'] }]) })
    expect(getByText('charge_manager.week.on')).toBeInTheDocument()
    expect(queryByText('charge_manager.week.eco')).toBeNull()
  })

  it('marks now on today’s row', () => {
    const { container } = render(WeekStrip, { week, now: { day: 'tuesday', minutes: 720 } })
    const marker = container.querySelector('[data-now]')
    expect(marker.closest('[data-day]').dataset.day).toBe('tuesday')
    expect(marker.style.left).toBe('50%')
  })

  it('tells screen readers each day in words', () => {
    const { getByRole } = render(WeekStrip, { week })
    const list = getByRole('list', { name: 'charge_manager.week.title' })
    const items = list.querySelectorAll('li')
    expect(items).toHaveLength(7)
    expect(plain(items[0].textContent)).toBe(
      'days.monday: ' +
        [
          'charge_manager.week.span:{"kind":"charge_manager.week.on","from":"12:00 AM","to":"6:00 AM"}',
          'charge_manager.week.span:{"kind":"charge_manager.week.off","from":"6:00 AM","to":"11:00 PM"}',
          'charge_manager.week.span:{"kind":"charge_manager.week.on","from":"11:00 PM","to":"12:00 AM"}',
        ].join(', '),
    )
  })
})
