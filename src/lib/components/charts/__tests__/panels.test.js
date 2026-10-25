import { describe, it, expect, vi } from 'vitest'
import { panelOpts, PANEL_AXIS_SIZE, liveDotPlugin, targetLinePlugin } from '../panels'

const theme = { accent: '#3cc6bd', charging: '#3cc6bd', warning: '#e7a948', success: '#2f9e5b', axisText: '#6b7585', grid: '#1c2230', surface: '#1a1f2b' }
const base = { scale: 'a', label: 'A', range: [0, 40], syncKey: 'k', showX: false }

describe('panelOpts', () => {
  it('gives the panel a single value axis of a fixed width, so stacked panels line up', () => {
    const o = panelOpts(theme, base)
    expect(o.axes).toHaveLength(2)
    expect(o.axes[1].scale).toBe('a')
    expect(o.axes[1].size).toBe(PANEL_AXIS_SIZE)
    expect(o.scales.a.range).toEqual([0, 40])
  })

  it('draws one series in the accent colour, with no marker on every point', () => {
    const o = panelOpts(theme, base)
    expect(o.series).toHaveLength(2)
    expect(o.series[1].stroke).toBe(theme.accent)
    expect(o.series[1].points.show).toBe(false)
  })

  it('shares its cursor with the other panels by key', () => {
    expect(panelOpts(theme, base).cursor.sync.key).toBe('k')
  })

  it('labels the time axis only on the bottom panel', () => {
    const xValues = (_u, splits) => splits.map((s) => `t${s}`)
    const top = panelOpts(theme, { ...base, xValues })
    const bottom = panelOpts(theme, { ...base, showX: true, xValues })
    expect(top.axes[0].values(null, [1, 2])).toEqual(['', ''])
    expect(bottom.axes[0].values(null, [1, 2])).toEqual(['t1', 't2'])
  })

  it('leaves the legend to the page', () => {
    expect(panelOpts(theme, base).legend.show).toBe(false)
  })
})

// A fake canvas context that records what was drawn.
function fakeU(data, scale = 'a') {
  const calls = []
  const ctx = new Proxy({}, {
    get: (_t, k) => (k in _t ? _t[k] : (...args) => calls.push([k, ...args])),
    set: (t, k, v) => { t[k] = v; return true },
  })
  return {
    u: { data, series: [{}, { scale }], ctx, bbox: { left: 0, top: 0, width: 100, height: 50 }, valToPos: (v) => v },
    calls,
  }
}

describe('liveDotPlugin', () => {
  it('marks the newest real reading of the series', () => {
    const { u, calls } = fakeU([[1, 2, 3], [5, 6, null]])
    liveDotPlugin('#3cc6bd', '#1a1f2b').hooks.draw(u)
    const arcs = calls.filter((c) => c[0] === 'arc')
    expect(arcs.length).toBeGreaterThan(0)
    expect(arcs[0].slice(1, 3)).toEqual([2, 6]) // x=2, y=6: the last non-null point
  })
  it('draws nothing without a reading', () => {
    const { u, calls } = fakeU([[], []])
    liveDotPlugin('#3cc6bd', '#1a1f2b').hooks.draw(u)
    expect(calls).toHaveLength(0)
  })
})

describe('targetLinePlugin', () => {
  it('draws a labelled dashed line at the target', () => {
    const { u, calls } = fakeU([[1], [50]], 'soc')
    targetLinePlugin(80, '#6b7585', 'Target 80%').hooks.draw(u)
    expect(calls.some((c) => c[0] === 'setLineDash')).toBe(true)
    expect(calls.some((c) => c[0] === 'fillText' && c[1] === 'Target 80%')).toBe(true)
  })
  it('draws nothing without a target', () => {
    const { u, calls } = fakeU([[1], [50]], 'soc')
    targetLinePlugin(null, '#6b7585', '').hooks.draw(u)
    expect(calls).toHaveLength(0)
  })
})
