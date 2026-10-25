import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import StatChips from '../StatChips.svelte'

const live = {
  sessionKwh: '12.30', elapsed: '01:42:09', currentA: '32.0',
  temp: 42.7, tempUnit: 'units.celsius',
}
const summary = { todayKwh: '3.2', totalKwh: '7523' }

describe('StatChips', () => {
  it('shows live chips when charging', () => {
    const { getByText } = render(StatChips, { props: { charging: true, live, summary } })
    expect(getByText('12.30')).toBeInTheDocument()
    expect(getByText('01:42:09')).toBeInTheDocument()
  })
  it('shows the charge ETA under the elapsed chip when present', () => {
    const { getByText } = render(StatChips, {
      props: { charging: true, live: { ...live, toFull: '1h 20m' }, summary },
    })
    expect(getByText('dashboard.vehicle.to_full')).toBeInTheDocument()
  })
  it('omits the charge ETA when the topic is absent', () => {
    const { queryByText } = render(StatChips, {
      props: { charging: true, live: { ...live, toFull: '' }, summary },
    })
    expect(queryByText('dashboard.vehicle.to_full')).toBeNull()
  })
  it('shows the today/total summary when not charging', () => {
    const { getByText } = render(StatChips, { props: { charging: false, live, summary } })
    expect(getByText('3.2')).toBeInTheDocument()
    expect(getByText('7523')).toBeInTheDocument()
  })
  // One amp number on the dashboard's tiles, named for what it is: what the
  // car draws. Pilot and voltage are Monitoring's.
  it('labels the measured current as the charging current', () => {
    const { getByText } = render(StatChips, { props: { charging: true, live, summary } })
    expect(getByText('32.0 A').parentElement).toHaveTextContent('dashboard.chips.charging_current')
  })
  it('leaves pilot and voltage to Monitoring', () => {
    const { queryByText } = render(StatChips, { props: { charging: true, live, summary } })
    expect(queryByText(/dashboard\.chips\.(pilot|voltage)/)).toBeNull()
    expect(queryByText(/240 V/)).toBeNull()
  })
  it('keeps the charger temperature as a tile', () => {
    const { getByText } = render(StatChips, { props: { charging: true, live, summary } })
    expect(getByText('42.7units.celsius').parentElement).toHaveTextContent('dashboard.chips.temp')
  })
})
