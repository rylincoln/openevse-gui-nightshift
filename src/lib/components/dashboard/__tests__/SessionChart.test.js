import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k, opts) => (opts?.values ? k + ':' + JSON.stringify(opts.values) : k)
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

// Capture the opts and data each uPlot panel is built with.
const ctor = vi.fn()
vi.mock('uplot', () => ({
  default: class MockUplot {
    constructor(opts, data) { ctor(opts, data) }
    setData() {}
    setSize() {}
    destroy() {}
  },
}))

import SessionChart from '../SessionChart.svelte'

const S = (ts, a, s) => ({ ts, a, t: 0, e: 0, s })
// Each panel is rebuilt once the window height binding settles, so compare
// the set of panels built rather than the number of constructions.
const panels = () => [...new Set(ctor.mock.calls.map(([opts]) => opts.series[1].scale))]
const session = [S(1000, 32, 52), S(1600, 32, 60), S(2200, 30, 74)]

beforeEach(() => ctor.mockClear())

describe('SessionChart', () => {
  it('shows the collecting placeholder when there are fewer than 2 in-session samples', () => {
    const { getByText } = render(SessionChart, {
      props: { samples: [S(1000, 32, 50)], voltage: 240, target: 80, sessionElapsed: 600 },
    })
    expect(getByText('dashboard.session.collecting')).toBeInTheDocument()
  })

  it('clips to the current session before deciding the placeholder', () => {
    // two samples exist, but only one falls inside the 100 s session window
    const { getByText } = render(SessionChart, {
      props: { samples: [S(1000, 32, 50), S(2000, 32, 60)], voltage: 240, target: 80, sessionElapsed: 100 },
    })
    expect(getByText('dashboard.session.collecting')).toBeInTheDocument()
  })

  it('draws state of charge and power as two titled panels, one measure each', () => {
    const { getByText } = render(SessionChart, { props: { samples: session, voltage: 240, target: 80, sessionElapsed: 3600 } })
    expect(panels()).toEqual(['soc', 'kw'])
    expect(getByText('dashboard.session.soc_title')).toBeInTheDocument()
    expect(getByText('dashboard.session.power_title')).toBeInTheDocument()
  })

  it('draws only the power panel when the car reports no state of charge', () => {
    const noSoc = session.map((s) => ({ ...s, s: -1 }))
    const { queryByText } = render(SessionChart, { props: { samples: noSoc, voltage: 240, sessionElapsed: 3600 } })
    expect(panels()).toEqual(['kw'])
    expect(queryByText('dashboard.session.soc_title')).toBeNull()
  })

  it('describes the session in words for screen readers', () => {
    const { getByRole } = render(SessionChart, { props: { samples: session, voltage: 240, target: 80, sessionElapsed: 3600 } })
    const figure = getByRole('figure')
    expect(figure).toHaveTextContent('dashboard.session.summary_soc:{"from":52,"to":74,"target":80}')
    expect(figure).toHaveTextContent('dashboard.session.summary_power:{"peak":"7.7","now":"7.2"}')
  })
})
