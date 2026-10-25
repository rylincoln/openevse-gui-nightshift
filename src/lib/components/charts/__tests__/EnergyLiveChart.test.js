import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k, opts) => (opts?.values ? k + ':' + JSON.stringify(opts.values) : k)
  t.subscribe = (fn) => { fn(t); return () => {} }
  const locale = { subscribe: (fn) => { fn('en'); return () => {} } }
  return { _: t, locale }
})

// Capture the opts and data each uPlot panel is built with (uPlot is mocked out).
const ctor = vi.fn()
vi.mock('uplot', () => ({
  default: class MockUplot {
    constructor(opts, data, target) { ctor(opts, data, target) }
    setData() {}
    setSize() {}
    destroy() {}
  },
}))

import EnergyLiveChart from '../EnergyLiveChart.svelte'
import { config_store } from '../../../stores/config'

const samplesWithSoc = [
  { ts: 1, a: 10, t: 25, e: 0, s: 40 },
  { ts: 2, a: 12, t: 30, e: 0, s: 42 },
]
const noSoc = samplesWithSoc.map((s) => ({ ...s, s: -1 }))

// The last build of each panel, by its scale.
const built = () => {
  const out = {}
  for (const [opts, data] of ctor.mock.calls) out[opts.series[1].scale] = { opts, data }
  return out
}

beforeEach(() => ctor.mockClear())
afterEach(() => config_store.set({}))

describe('EnergyLiveChart panels', () => {
  it('draws current, temperature and SOC as separate panels, one axis each', () => {
    render(EnergyLiveChart, { props: { samples: samplesWithSoc } })
    const panels = built()
    expect(Object.keys(panels)).toEqual(['a', 't', 'soc'])
    for (const { opts } of Object.values(panels)) {
      expect(opts.axes).toHaveLength(2)
      expect(opts.series).toHaveLength(2)
    }
  })

  it('leaves the SOC panel out when no vehicle reports it', () => {
    render(EnergyLiveChart, { props: { samples: noSoc } })
    expect(Object.keys(built())).toEqual(['a', 't'])
  })

  it('prints the time only under the bottom panel', () => {
    render(EnergyLiveChart, { props: { samples: samplesWithSoc } })
    const { a, soc } = built()
    expect(a.opts.axes[0].values(null, [1, 2])).toEqual(['', ''])
    expect(soc.opts.axes[0].values).toBeUndefined() // uPlot's own time labels
  })

  it('moves every panel’s cursor together', () => {
    render(EnergyLiveChart, { props: { samples: samplesWithSoc } })
    const keys = Object.values(built()).map(({ opts }) => opts.cursor.sync.key)
    expect(new Set(keys).size).toBe(1)
  })

  it('reads out each measure at the latest sample beside its title', () => {
    const { getByText } = render(EnergyLiveChart, { props: { samples: samplesWithSoc } })
    expect(getByText('monitoring.energy.axis.current')).toBeInTheDocument()
    expect(getByText('12 A')).toBeInTheDocument()
    expect(getByText('42%')).toBeInTheDocument()
  })

  it('describes each measure for screen readers', () => {
    const { getByRole } = render(EnergyLiveChart, { props: { samples: samplesWithSoc } })
    expect(getByRole('figure')).toHaveTextContent(
      'monitoring.energy.summary:{"measure":"monitoring.energy.axis.current","min":"10 A","max":"12 A","latest":"12 A"}',
    )
  })
})

// The device always sends °C. Converting the samples but leaving the scale
// bounds or the title in °C would be worse than not converting at all, so
// all three are asserted together.
describe('EnergyLiveChart temperature unit', () => {
  it('plots Celsius unchanged by default', () => {
    const { getByText } = render(EnergyLiveChart, { props: { samples: noSoc } })
    const { t } = built()
    expect(t.data[1]).toEqual([25, 30])
    expect(t.opts.scales.t.range).toEqual([-20, 80])
    expect(getByText('monitoring.energy.axis.temperature:{"unit":"units.celsius"}')).toBeInTheDocument()
  })

  it('converts the series, the scale bounds and the title for Fahrenheit', () => {
    config_store.set({ temp_unit: 'f' })
    const { getByText } = render(EnergyLiveChart, { props: { samples: noSoc } })
    const { t } = built()
    expect(t.data[1]).toEqual([77, 86])
    expect(t.opts.scales.t.range).toEqual([-4, 176])
    expect(getByText('monitoring.energy.axis.temperature:{"unit":"units.fahrenheit"}')).toBeInTheDocument()
  })

  it('keeps the no-reading sentinel on the raw Celsius value', () => {
    // `t <= 0` means "no sensor". In °F those readings are positive numbers,
    // so testing after conversion would plot them as real data.
    config_store.set({ temp_unit: 'f' })
    render(EnergyLiveChart, { props: { samples: [{ ts: 1, a: 0, t: 0, e: 0, s: -1 }] } })
    expect(built().t.data[1]).toEqual([null])
  })
})
