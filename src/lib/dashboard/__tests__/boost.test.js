import { describe, it, expect } from 'vitest'
import { boostTarget } from '../boost'

const t = (k, opts) => (opts?.values ? `${k}(${opts.values.value})` : k)

describe('boostTarget', () => {
  it('is empty with no boost', () => {
    expect(boostTarget(null, t, 'km')).toBe('')
  })
  it('names each target in its own unit', () => {
    expect(boostTarget({ type: 'time', value: 5400 }, t, 'km')).toBe('dashboard.boost.for(1:30:00)')
    expect(boostTarget({ type: 'energy', value: 5000 }, t, 'km')).toBe('dashboard.boost.add(5.0 units.kwh)')
    expect(boostTarget({ type: 'soc', value: 80 }, t, 'km')).toBe('dashboard.boost.until(80units.percent)')
    expect(boostTarget({ type: 'range', value: 250 }, t, 'mi')).toBe('dashboard.boost.until(250 mi)')
  })
})
