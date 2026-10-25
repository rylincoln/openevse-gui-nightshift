import { describe, it, expect } from 'vitest'
import { controlSegments, readChargeMode, selectChargeMode, setChargeRate } from '../chargeMode'
import { EvseClients } from '../../vars'

// A snapshot of what the charger reports, with nothing claimed and divert off.
function snapshot(over = {}) {
  return {
    claimsTarget: { properties: {}, claims: {} },
    divertmode: 1,
    divertEnabled: false,
    override: undefined,
    limit: { type: 'none', value: 0, auto_release: true },
    defaultRate: 32,
    ...over,
  }
}

// The state claim is owned by `client`, asking for `state`.
function owned(client, state) {
  return { properties: { state }, claims: { state: EvseClients[client].id } }
}

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
    setOverride: (o) => answer('setOverride', o),
    clearOverride: () => answer('clearOverride'),
    setDivertMode: (dm) => answer('setDivertMode', dm),
    clearLimit: () => answer('clearLimit'),
  }
}

describe('controlSegments', () => {
  it('includes the eco segment when divert is enabled', () => {
    expect(controlSegments(true)).toEqual(['off', 'auto', 'eco', 'on'])
  })
  it('omits the eco segment when divert is disabled', () => {
    expect(controlSegments(false)).toEqual(['off', 'auto', 'on'])
  })
})

describe('readChargeMode', () => {
  it('is Auto, owned by nobody, when no client claims the state', () => {
    expect(readChargeMode(snapshot())).toEqual({
      segment: 'auto',
      owner: '',
      locked: null,
      limitReached: false,
    })
  })

  it('treats a snapshot that has not loaded yet as Auto', () => {
    expect(readChargeMode(snapshot({ claimsTarget: undefined, divertmode: undefined })).segment).toBe('auto')
  })

  it('is On while the Manual override holds the charger active', () => {
    const mode = readChargeMode(snapshot({ claimsTarget: owned('manual', 'active') }))
    expect(mode.segment).toBe('on')
    expect(mode.owner).toBe('manual')
  })

  it('is Off while the Manual override holds the charger disabled, whatever divert is doing', () => {
    const mode = readChargeMode(
      snapshot({ claimsTarget: owned('manual', 'disabled'), divertEnabled: true, divertmode: 2 }),
    )
    expect(mode.segment).toBe('off')
  })

  it('is Eco when no override is set and solar divert is enabled and active', () => {
    expect(readChargeMode(snapshot({ divertEnabled: true, divertmode: 2 })).segment).toBe('eco')
  })

  it('is Auto when divert is enabled but not active', () => {
    expect(readChargeMode(snapshot({ divertEnabled: true, divertmode: 1 })).segment).toBe('auto')
  })

  it('never reports Eco when divert is not enabled, even if divertmode says 2', () => {
    expect(readChargeMode(snapshot({ divertEnabled: false, divertmode: 2 })).segment).toBe('auto')
  })

  it('names the client that owns the decision', () => {
    expect(readChargeMode(snapshot({ claimsTarget: owned('timer', 'disabled') })).owner).toBe('timer')
  })

  it.each([
    ['ocpp', 'OCPP'],
    ['rfid', 'RFID'],
  ])('is Locked while %s owns the decision', (client, label) => {
    expect(readChargeMode(snapshot({ claimsTarget: owned(client, 'disabled') })).locked).toBe(label)
  })

  it('reports a reached charge limit without locking the controls', () => {
    const mode = readChargeMode(snapshot({ claimsTarget: owned('limit', 'disabled') }))
    expect(mode.limitReached).toBe(true)
    expect(mode.locked).toBeNull()
  })
})

describe('selectChargeMode', () => {
  it('picks Off with a sticky disabled override at the default rate', async () => {
    const charger = fakeCharger()
    expect(await selectChargeMode('off', snapshot(), charger)).toBe(true)
    expect(charger.calls).toEqual([
      ['setOverride', { state: 'disabled', charge_current: 32, auto_release: false }],
    ])
  })

  it('keeps the charge rate the override already carries', async () => {
    const charger = fakeCharger()
    await selectChargeMode('on', snapshot({ override: { state: 'disabled', charge_current: 20 } }), charger)
    expect(charger.calls).toEqual([
      ['setOverride', { state: 'active', charge_current: 20, auto_release: false }],
    ])
  })

  it('picking On past a reached User limit clears the limit after the override', async () => {
    const charger = fakeCharger()
    const s = snapshot({
      claimsTarget: owned('limit', 'disabled'),
      limit: { type: 'energy', value: 5000, auto_release: true },
    })
    expect(await selectChargeMode('on', s, charger)).toBe(true)
    expect(charger.calls.map(([name]) => name)).toEqual(['setOverride', 'clearLimit'])
  })

  it('never clears a reached Default limit', async () => {
    const charger = fakeCharger()
    const s = snapshot({
      claimsTarget: owned('limit', 'disabled'),
      limit: { type: 'energy', value: 5000, auto_release: false },
    })
    expect(await selectChargeMode('on', s, charger)).toBe(true)
    expect(charger.calls.map(([name]) => name)).toEqual(['setOverride'])
  })

  it('stops, and reports failure, when the override is refused', async () => {
    const charger = fakeCharger({ setOverride: true })
    const s = snapshot({ claimsTarget: owned('limit', 'disabled') })
    expect(await selectChargeMode('on', s, charger)).toBe(false)
    expect(charger.calls.map(([name]) => name)).toEqual(['setOverride'])
  })

  it('reports failure when clearing the reached limit fails', async () => {
    const charger = fakeCharger({ clearLimit: true })
    const s = snapshot({ claimsTarget: owned('limit', 'disabled') })
    expect(await selectChargeMode('on', s, charger)).toBe(false)
  })

  it('picks Auto by releasing the override, then turning divert off', async () => {
    const charger = fakeCharger()
    const s = snapshot({ override: { state: 'active', charge_current: 32, auto_release: false } })
    expect(await selectChargeMode('auto', s, charger)).toBe(true)
    expect(charger.calls).toEqual([['clearOverride'], ['setDivertMode', 1]])
  })

  it('picks Eco without a release when no override is set', async () => {
    const charger = fakeCharger()
    expect(await selectChargeMode('eco', snapshot({ override: {} }), charger)).toBe(true)
    expect(charger.calls).toEqual([['setDivertMode', 2]])
  })

  it('does not touch divert when releasing the override fails', async () => {
    const charger = fakeCharger({ clearOverride: true })
    const s = snapshot({ override: { state: 'disabled' } })
    expect(await selectChargeMode('eco', s, charger)).toBe(false)
    expect(charger.calls).toEqual([['clearOverride']])
  })

  it('reports failure when the divert write fails', async () => {
    const charger = fakeCharger({ setDivertMode: true })
    expect(await selectChargeMode('auto', snapshot(), charger)).toBe(false)
  })
})

describe('setChargeRate', () => {
  it('sets the rate on a sticky override, keeping what the override already says', async () => {
    const charger = fakeCharger()
    const s = snapshot({ override: { state: 'disabled', charge_current: 16, auto_release: false } })
    expect(await setChargeRate(20, s, charger)).toBe(true)
    expect(charger.calls).toEqual([
      ['setOverride', { state: 'disabled', charge_current: 20, auto_release: false }],
    ])
  })

  it('returning to the default rate drops the rate from an override that also sets the state', async () => {
    const charger = fakeCharger()
    const s = snapshot({ override: { state: 'disabled', charge_current: 16, auto_release: false } })
    expect(await setChargeRate(32, s, charger)).toBe(true)
    expect(charger.calls).toEqual([['setOverride', { state: 'disabled', auto_release: false }]])
  })

  it('returning to the default rate releases an override that only set the rate', async () => {
    const charger = fakeCharger()
    const s = snapshot({ override: { charge_current: 16, auto_release: false } })
    expect(await setChargeRate(32, s, charger)).toBe(true)
    expect(charger.calls).toEqual([['clearOverride']])
  })

  it('returning to the default rate writes nothing when no rate is overridden', async () => {
    const charger = fakeCharger()
    expect(await setChargeRate(32, snapshot({ override: { state: 'active' } }), charger)).toBe(true)
    expect(charger.calls).toEqual([])
  })

  it('does not change the snapshot it was given', async () => {
    const override = { state: 'disabled', charge_current: 16, auto_release: false }
    await setChargeRate(32, snapshot({ override }), fakeCharger())
    expect(override).toEqual({ state: 'disabled', charge_current: 16, auto_release: false })
  })

  it.each([
    ['a new rate', 20, 'setOverride'],
    ['the default rate', 32, 'clearOverride'],
  ])('reports failure when writing %s fails', async (_, amps, method) => {
    const charger = fakeCharger({ [method]: true })
    const s = snapshot({ override: { charge_current: 16, auto_release: false } })
    expect(await setChargeRate(amps, s, charger)).toBe(false)
  })
})
