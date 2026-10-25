import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k, opts) => (opts?.values ? k + ':' + JSON.stringify(opts.values) : k)
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

vi.mock('uplot', () => {
  class MockUplot {
    setData() {}
    setSize() {}
    destroy() {}
  }
  MockUplot.paths = { bars: () => () => null }
  return { default: MockUplot }
})

import EnergySummaryChart from '../EnergySummaryChart.svelte'

describe('EnergySummaryChart', () => {
  it('says there is nothing to show when there are no rows', () => {
    const { getByText } = render(EnergySummaryChart, { props: { rows: [] } })
    expect(getByText('monitoring.energy.no_samples')).toBeInTheDocument()
  })

  it('describes the bars in words for screen readers', () => {
    const rows = [
      { label: 'May 1', kwh: 4.25 },
      { label: 'May 2', kwh: 12.5 },
      { label: 'May 3', kwh: 0 },
    ]
    const { getByRole } = render(EnergySummaryChart, { props: { rows } })
    expect(getByRole('figure')).toHaveTextContent(
      'monitoring.energy.summary_bars:{"total":"16.8","max":"12.5","label":"May 2","n":3}',
    )
  })
})
