import { describe, it, expect } from 'vitest'
import { rateCap } from '../rate'
import { EvseClients } from '../../vars'

const target = (max_current, client) => ({
  properties: { state: 'active', charge_current: 32, max_current },
  claims: { state: EvseClients.manual.id, max_current: client },
})

describe('rateCap', () => {
  it('names the client capping the current below the requested rate', () => {
    expect(rateCap(target(24, EvseClients.shaper.id), 32)).toEqual({ amps: 24, client: 'shaper' })
    expect(rateCap(target(16, EvseClients.loadsharing.id), 32)).toEqual({ amps: 16, client: 'loadsharing' })
  })
  it('is null when the cap is at or above the requested rate', () => {
    expect(rateCap(target(32, EvseClients.shaper.id), 32)).toBeNull()
    expect(rateCap(target(40, EvseClients.shaper.id), 32)).toBeNull()
  })
  it('is null when no client caps the current', () => {
    expect(rateCap({ properties: { charge_current: 32 }, claims: { state: 1 } }, 32)).toBeNull()
    expect(rateCap(null, 32)).toBeNull()
  })
})
