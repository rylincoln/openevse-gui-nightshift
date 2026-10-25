import { describe, it, expect } from 'vitest'
import {
  clipToSession,
  sampleKw,
  socOrNull,
  toChartData,
  kwAxisMax,
  fmtSessionTime,
} from '../sessionChart'

const S = (ts, a, s) => ({ ts, a, t: 0, e: 0, s })

describe('clipToSession', () => {
  it('keeps only samples within session_elapsed of the latest ts', () => {
    const samples = [S(1000, 32, 50), S(1600, 32, 55), S(2000, 32, 60)]
    // latest ts 2000, elapsed 500 -> start 1500 -> drop the 1000 sample
    expect(clipToSession(samples, 500).map((x) => x.ts)).toEqual([1600, 2000])
  })
  it('returns all samples when elapsed is missing or non-positive (fallback)', () => {
    const samples = [S(1000, 32, 50), S(2000, 32, 60)]
    expect(clipToSession(samples, 0)).toHaveLength(2)
    expect(clipToSession(samples, NaN)).toHaveLength(2)
  })
  it('returns [] for empty / non-array input', () => {
    expect(clipToSession([], 500)).toEqual([])
    expect(clipToSession(undefined, 500)).toEqual([])
  })
})

describe('sampleKw', () => {
  it('returns kW = amps * volts / 1000 (single phase by default)', () => {
    expect(sampleKw({ a: 32 }, 240)).toBeCloseTo(7.68)
    expect(sampleKw({ a: 32 }, 240, 1)).toBeCloseTo(7.68)
  })
  it('multiplies by the phase count on a 3-phase device', () => {
    // The firmware reports per-phase amps; total power is amps * volts * phases.
    expect(sampleKw({ a: 32 }, 240, 3)).toBeCloseTo(23.04)
  })
  it('returns null when voltage is missing or zero', () => {
    expect(sampleKw({ a: 32 }, 0)).toBeNull()
    expect(sampleKw({ a: 32 }, undefined)).toBeNull()
  })
  it('returns null when amps is not finite', () => {
    expect(sampleKw({ a: undefined }, 240)).toBeNull()
  })
})

describe('socOrNull', () => {
  it('passes through a non-negative SOC', () => {
    expect(socOrNull({ s: 74 })).toBe(74)
    expect(socOrNull({ s: 0 })).toBe(0)
  })
  it('maps the -1 no-vehicle sentinel (and any negative) to null', () => {
    expect(socOrNull({ s: -1 })).toBeNull()
    expect(socOrNull({ s: undefined })).toBeNull()
  })
})

describe('toChartData', () => {
  it('builds [relativeSeconds, soc, kw] arrays', () => {
    const samples = [S(1000, 32, 50), S(1300, 16, -1), S(1600, 32, 60)]
    const [x, soc, kw] = toChartData(samples, 240)
    expect(x).toEqual([0, 300, 600]) // seconds from first ts
    expect(soc).toEqual([50, null, 60]) // -1 -> null gap
    expect(kw[0]).toBeCloseTo(7.68)
    expect(kw[1]).toBeCloseTo(3.84)
  })
  it('triples the kW values when given 3 phases', () => {
    const samples = [S(1000, 32, 50), S(1300, 16, -1)]
    const [, , kw] = toChartData(samples, 240, 3)
    expect(kw[0]).toBeCloseTo(23.04)
    expect(kw[1]).toBeCloseTo(11.52)
  })
})

describe('kwAxisMax', () => {
  it('floors at 4', () => {
    expect(kwAxisMax([1, 2, 3])).toBe(4)
  })
  it('uses peak + 1 headroom, ignoring nulls, rounded up', () => {
    expect(kwAxisMax([3, null, 9.2])).toBe(11)
  })
  it('returns 4 when there are no finite values', () => {
    expect(kwAxisMax([null, null])).toBe(4)
  })
})

describe('fmtSessionTime', () => {
  it('formats seconds as minutes', () => {
    expect(fmtSessionTime(0)).toBe('0')
    expect(fmtSessionTime(1500)).toBe('25m')
  })
  it('rolls into h:mm past an hour', () => {
    expect(fmtSessionTime(3900)).toBe('1h05')
  })
  it('promotes a value that rounds up to a full hour', () => {
    expect(fmtSessionTime(3570)).toBe('1h00') // 59.5 min rounds to 60 -> 1h00
  })
})

import { buildSocOpts, buildKwOpts } from '../sessionChart'

const theme = { accent: '#3cc6bd', axisText: '#6b7585', grid: '#1c2230', surface: '#1a1f2b' }

// The session is two panels on one time axis, never one plot with two
// y-axes: state of charge on top, power below.
describe('buildSocOpts', () => {
  const o = buildSocOpts({ theme, target: 80, targetLabel: 'Target 80%', height: 120, syncKey: 's' })
  it('plots SOC alone, 0–100, on one axis', () => {
    expect(o.scales.soc.range).toEqual([0, 100])
    expect(o.axes).toHaveLength(2)
    expect(o.series).toHaveLength(2)
    expect(o.series[1].scale).toBe('soc')
  })
  it('marks the target and the latest reading', () => {
    expect(o.plugins).toHaveLength(2)
  })
  it('leaves the time labels to the panel below', () => {
    expect(o.axes[0].values(null, [60, 120])).toEqual(['', ''])
  })
  it('leaves the % to the panel title, so "100" fits the fixed axis width', () => {
    expect(o.axes[1].values).toBeUndefined()
  })
  it('shares its cursor with the power panel', () => {
    const k = buildKwOpts({ theme, kwMax: 8, height: 80, syncKey: 's' })
    expect(o.cursor.sync.key).toBe(k.cursor.sync.key)
  })
})

describe('buildKwOpts', () => {
  const o = buildKwOpts({ theme, kwMax: 8, height: 80, syncKey: 's' })
  it('plots kW alone, from zero to the headroom ceiling', () => {
    expect(o.scales.kw.range).toEqual([0, 8])
    expect(o.axes).toHaveLength(2)
    expect(o.series[1].scale).toBe('kw')
  })
  it('prints the session time under itself', () => {
    expect(o.axes[0].values(null, [0, 1500])).toEqual(['0', '25m'])
  })
})
