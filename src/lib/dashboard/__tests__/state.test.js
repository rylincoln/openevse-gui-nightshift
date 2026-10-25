import { describe, it, expect } from 'vitest'
import { displayState, ringFill, limitProgress, maxPowerW, vehicleConnected, clampEnergyMax, ENERGY_LIMIT_MAX_KWH } from '../state'

describe('clampEnergyMax', () => {
  it('keeps a sensible value untouched', () => {
    expect(clampEnergyMax(40)).toBe(40)
    expect(clampEnergyMax(100)).toBe(100)
  })
  it('rounds to a whole kWh', () => {
    expect(clampEnergyMax(42.6)).toBe(43)
  })
  it('floors at 1 kWh for zero / blank / negative input', () => {
    expect(clampEnergyMax(0)).toBe(100) // 0 is "unset" → default
    expect(clampEnergyMax(null)).toBe(100)
    expect(clampEnergyMax(undefined)).toBe(100)
    expect(clampEnergyMax(-5)).toBe(1)
  })
  it('caps pathological values at the hard ceiling (no giant stop array)', () => {
    expect(clampEnergyMax(100000)).toBe(ENERGY_LIMIT_MAX_KWH)
  })
})

describe('displayState', () => {
  it('returns starting when status is missing or state 0', () => {
    expect(displayState(undefined)).toBe('starting')
    expect(displayState({})).toBe('starting')
    expect(displayState({ state: 0 })).toBe('starting')
  })
  it('maps EVSE state codes', () => {
    expect(displayState({ state: 1 })).toBe('idle')
    expect(displayState({ state: 2 })).toBe('connected')
    expect(displayState({ state: 254 })).toBe('sleeping')
    expect(displayState({ state: 3 })).toBe('charging')
  })
  it('treats Disabled (255) as off only when the owner picked Off', () => {
    // A scheduled rule or the default state can hold the charger Disabled
    // rather than Sleeping (config pause_uses_disabled); that is still a pause.
    expect(displayState({ state: 255 }, 'off')).toBe('off')
    expect(displayState({ state: 255 }, 'auto')).toBe('sleeping')
  })
  it('treats state 254 with Off picked as off, not sleeping', () => {
    // The "Off" mode just drops charge_current to 0 — device sits in
    // sleeping (254). Without the charge mode, that's indistinguishable
    // from auto-waiting-on-a-timer.
    expect(displayState({ state: 254 }, 'off')).toBe('off')
    expect(displayState({ state: 254 }, 'auto')).toBe('sleeping')
    expect(displayState({ state: 254 }, 'on')).toBe('sleeping')
    // Same disambiguation for an unplugged-but-disabled device (state 1 + Off).
    expect(displayState({ state: 1 }, 'off')).toBe('off')
    expect(displayState({ state: 1 }, 'auto')).toBe('idle')
    expect(displayState({ state: 4 })).toBe('error')
    expect(displayState({ state: 9 })).toBe('error')
    expect(displayState({ state: 11 })).toBe('error')
  })
})

describe('vehicleConnected', () => {
  it('trusts the firmware vehicle flag over the state code', () => {
    // The flag stays accurate through Sleeping/Off where the state code can't
    // tell — a plugged-in car paused on a schedule (254) still reads connected.
    expect(vehicleConnected({ vehicle: 1, state: 254 })).toBe(true)
    expect(vehicleConnected({ vehicle: 1, state: 255 })).toBe(true)
    // ...and an unplugged car reads disconnected even mid-fault.
    expect(vehicleConnected({ vehicle: 0, state: 3 })).toBe(false)
  })
  it('falls back to the state code when the flag is absent', () => {
    expect(vehicleConnected({ state: 2 })).toBe(true) // connected
    expect(vehicleConnected({ state: 3 })).toBe(true) // charging
    expect(vehicleConnected({ state: 1 })).toBe(false) // no car
    expect(vehicleConnected({ state: 254 })).toBe(false) // sleeping, unknown → assume not
  })
  it('is false for missing status', () => {
    expect(vehicleConnected(undefined)).toBe(false)
    expect(vehicleConnected({})).toBe(false)
  })
})

describe('maxPowerW', () => {
  it('is max_current × voltage on single-phase', () => {
    expect(maxPowerW({ voltage: 240 }, { max_current_soft: 16 })).toBe(3840)
  })
  it('triples on three-phase', () => {
    expect(maxPowerW({ voltage: 240 }, { max_current_soft: 16, is_threephase: true })).toBe(11520)
  })
  it('is 0 when inputs are missing', () => {
    expect(maxPowerW(null, null)).toBe(0)
  })
})

describe('ringFill', () => {
  it('is power over max power when charging with no limit', () => {
    // 7000 W / (40 A * 240 V = 9600 W) = 0.729
    expect(ringFill({ power: 7000, voltage: 240 }, { max_current_soft: 40 }, null)).toBeCloseTo(0.729, 2)
  })
  it('clamps to 0..1', () => {
    expect(ringFill({ power: 99999, voltage: 240 }, { max_current_soft: 40 }, null)).toBe(1)
    expect(ringFill({ power: -50, voltage: 240 }, { max_current_soft: 40 }, null)).toBe(0)
  })
  it('returns 0 when max power is unusable', () => {
    expect(ringFill({ power: 7000, voltage: 0 }, { max_current_soft: 0 }, null)).toBe(0)
  })
  it('triples max power on three-phase to match the firmware-tripled power', () => {
    // Firmware reports power tripled on 3-phase, so max power must triple too.
    // 4800 W / (16 A * 240 V * 3 = 11520 W) = 0.417 — not an overflow.
    expect(
      ringFill({ power: 4800, voltage: 240 }, { max_current_soft: 16, is_threephase: true }, null),
    ).toBeCloseTo(0.417, 2)
  })
  it('uses limit progress when a limit is active', () => {
    const limit = { type: 'energy', value: 10000 }
    expect(ringFill({ power: 7000, voltage: 240, session_energy: 5000 }, { max_current_soft: 40 }, limit)).toBeCloseTo(0.5, 2)
  })
})

describe('limitProgress', () => {
  it('time limit: elapsed seconds over value-minutes', () => {
    expect(limitProgress({ type: 'time', value: 60 }, { session_elapsed: 1800 })).toBeCloseTo(0.5, 2)
  })
  it('energy limit: session_energy over value', () => {
    expect(limitProgress({ type: 'energy', value: 8000 }, { session_energy: 2000 })).toBeCloseTo(0.25, 2)
  })
  it('returns 0 for none/unknown or zero target', () => {
    expect(limitProgress({ type: 'none', value: 0 }, {})).toBe(0)
    expect(limitProgress({ type: 'time', value: 0 }, { session_elapsed: 100 })).toBe(0)
  })
})
