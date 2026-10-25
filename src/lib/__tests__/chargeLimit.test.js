import { describe, it, expect } from 'vitest'
import {
  readChargeLimit,
  setUserLimit,
  knobPercent,
  setKnob,
  setDefaultLimit,
  clearDefaultLimit,
  limitText,
  targetText,
} from '../chargeLimit'

const user = (type, value) => ({ type, value, auto_release: true })
const byDefault = (type, value) => ({ type, value, auto_release: false })
const none = { type: 'none', value: 0, auto_release: true }

// In-memory adapter for the charger seam: records each write in order and
// answers with the outcome given for that method (true unless told otherwise).
function fakeCharger(fail = {}) {
  const calls = []
  const answer = (name, arg) => {
    calls.push(arg === undefined ? [name] : [name, arg])
    return Promise.resolve(!fail[name])
  }
  return {
    calls,
    setLimit: (l) => answer('setLimit', l),
    clearLimit: () => answer('clearLimit'),
    saveConfig: (data) => answer('saveConfig', data),
  }
}

// A car at 74% that reckons 206 km of range, so about 278 km at 100%.
const knob = (over = {}) => ({ unit: 'percent', maxRange: 206 / 0.74, vehicleLimit: 80, ...over })

describe('readChargeLimit', () => {
  it('is null when the charger holds no limit', () => {
    expect(readChargeLimit(undefined)).toBeNull()
    expect(readChargeLimit(null)).toBeNull()
    expect(readChargeLimit(none)).toBeNull()
  })

  it('reads a User limit', () => {
    expect(readChargeLimit(user('soc', 80))).toEqual({ type: 'soc', value: 80, isDefault: false })
  })

  // The firmware's only marker for the Default limit.
  it('reads a limit that does not auto-release as the Default limit', () => {
    expect(readChargeLimit(byDefault('energy', 10000))).toEqual({ type: 'energy', value: 10000, isDefault: true })
  })
})

describe('setUserLimit', () => {
  it('sets a User limit, which auto-releases', async () => {
    const charger = fakeCharger()
    expect(await setUserLimit({ type: 'time', value: 120 }, none, charger)).toBe('done')
    expect(charger.calls).toEqual([['setLimit', user('time', 120)]])
  })

  it('may replace the Default limit: that leaves the config alone', async () => {
    const charger = fakeCharger()
    expect(await setUserLimit({ type: 'time', value: 60 }, byDefault('time', 120), charger)).toBe('done')
    expect(charger.calls).toEqual([['setLimit', user('time', 60)]])
  })

  it('clears a User limit', async () => {
    const charger = fakeCharger()
    expect(await setUserLimit(null, user('time', 120), charger)).toBe('done')
    expect(charger.calls).toEqual([['clearLimit']])
  })

  it('keeps the Default limit rather than delete it', async () => {
    const charger = fakeCharger()
    expect(await setUserLimit(null, byDefault('time', 120), charger)).toBe('kept')
    expect(charger.calls).toEqual([])
  })

  it.each([
    ['setting', { type: 'soc', value: 70 }, 'setLimit'],
    ['clearing', null, 'clearLimit'],
  ])('reports a refused write when %s', async (_, next, method) => {
    expect(await setUserLimit(next, user('soc', 60), fakeCharger({ [method]: true }))).toBe('failed')
  })
})

describe('knobPercent', () => {
  it('sits on a SOC limit', () => {
    expect(knobPercent(user('soc', 60), knob())).toBe(60)
  })

  it('sits on a range limit as a share of the range at 100%', () => {
    expect(knobPercent(user('range', 139), knob())).toBe(50)
  })

  // Past 100 the knob would clear the limit on first touch.
  it('stops at 100 for a range limit past the range estimate', () => {
    expect(knobPercent(user('range', 400), knob())).toBe(100)
  })

  it('rests at the car\'s own limit with no SOC or range limit to show', () => {
    expect(knobPercent(none, knob())).toBe(80)
    expect(knobPercent(user('time', 120), knob())).toBe(80)
    expect(knobPercent(user('range', 139), knob({ maxRange: null }))).toBe(80)
    expect(knobPercent(none, knob({ vehicleLimit: null }))).toBe(100)
  })
})

describe('setKnob', () => {
  it('sets a SOC User limit below the car\'s limit', async () => {
    const charger = fakeCharger()
    expect(await setKnob(70, knob(), none, charger)).toBe('done')
    expect(charger.calls).toEqual([['setLimit', user('soc', 70)]])
  })

  it('sets a range User limit while the knob reads range', async () => {
    const charger = fakeCharger()
    await setKnob(50, knob({ unit: 'range' }), none, charger)
    expect(charger.calls).toEqual([['setLimit', user('range', 139)]])
  })

  it('falls back to SOC when there is no range estimate', async () => {
    const charger = fakeCharger()
    await setKnob(50, knob({ unit: 'range', maxRange: null }), none, charger)
    expect(charger.calls).toEqual([['setLimit', user('soc', 50)]])
  })

  // Snap to clear: at or past the car's own limit the car governs.
  it.each([80, 95])('clears a SOC or range User limit at %i%', async (pct) => {
    const charger = fakeCharger()
    expect(await setKnob(pct, knob(), user('range', 139), charger)).toBe('done')
    expect(charger.calls).toEqual([['clearLimit']])
  })

  it('snaps back to the Default limit instead of clearing it', async () => {
    const charger = fakeCharger()
    expect(await setKnob(80, knob(), byDefault('soc', 70), charger)).toBe('kept')
    expect(charger.calls).toEqual([])
  })

  it('leaves a time or energy limit to its own editor', async () => {
    const charger = fakeCharger()
    expect(await setKnob(80, knob(), user('time', 120), charger)).toBe('done')
    expect(charger.calls).toEqual([])
  })

  it('reports a refused write', async () => {
    expect(await setKnob(70, knob(), none, fakeCharger({ setLimit: true }))).toBe('failed')
  })
})

describe('setDefaultLimit', () => {
  it('writes the type and value together; the firmware applies them at once', async () => {
    const charger = fakeCharger()
    expect(await setDefaultLimit({ type: 'energy', value: 10000 }, charger)).toBe(true)
    expect(charger.calls).toEqual([['saveConfig', { limit_default_type: 'energy', limit_default_value: 10000 }]])
  })

  it.each([
    ['no target', { type: 'none', value: 10000 }],
    ['a zero value', { type: 'time', value: 0 }],
  ])('writes nothing, and reports failure, for %s', async (_, target) => {
    const charger = fakeCharger()
    expect(await setDefaultLimit(target, charger)).toBe(false)
    expect(charger.calls).toEqual([])
  })

  it('reports a refused write', async () => {
    expect(await setDefaultLimit({ type: 'time', value: 60 }, fakeCharger({ saveConfig: true }))).toBe(false)
  })
})

describe('clearDefaultLimit', () => {
  it('clears the config first, then the limit the charger applied from it', async () => {
    const charger = fakeCharger()
    expect(await clearDefaultLimit(charger)).toBe(true)
    expect(charger.calls).toEqual([['saveConfig', { limit_default_type: 'none' }], ['clearLimit']])
  })

  // Deleting the limit while the config still names it would lose it
  // without the config saying so.
  it('leaves the limit alone when the config write is refused', async () => {
    const charger = fakeCharger({ saveConfig: true })
    expect(await clearDefaultLimit(charger)).toBe(false)
    expect(charger.calls).toEqual([['saveConfig', { limit_default_type: 'none' }]])
  })

  it('reports a refused limit clear', async () => {
    expect(await clearDefaultLimit(fakeCharger({ clearLimit: true }))).toBe(false)
  })
})

describe('wording', () => {
  const t = (k) => k

  it('says nothing without a limit', () => {
    expect(limitText(none, t, 'km')).toBe('')
    expect(limitText(undefined, t, 'km')).toBe('')
  })

  it('words each kind of limit, minutes as a duration', () => {
    expect(limitText(user('time', 90), t, 'km')).toBe('1:30:00')
    expect(limitText(user('energy', 5000), t, 'km')).toBe('5.0 units.kwh')
    expect(limitText(user('soc', 80), t, 'km')).toBe('80units.percent')
  })

  // Every other range readout honours mqtt_vehicle_range_miles.
  it('gives a range in the unit it is handed', () => {
    expect(limitText(user('range', 200), t, 'mi')).toBe('200 mi')
  })

  it('words a target whose time is in seconds, as Boost holds it', () => {
    expect(targetText('time', 5400, t, 'km')).toBe('1:30:00')
    expect(targetText('energy', 5000, t, 'km')).toBe('5.0 units.kwh')
  })
})
