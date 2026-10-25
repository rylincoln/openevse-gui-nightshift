import { describe, it, expect } from 'vitest'
import { pageTitle } from '../pageTitle'

const t = (k) => `<${k}>`

// Every screen used to be titled "OpenEVSE", so tabs, history and a screen
// reader's window list couldn't tell them apart.
describe('pageTitle', () => {
  it('names Home after the charger alone', () => {
    expect(pageTitle('/', 'Garage', t)).toBe('Garage')
  })

  it('puts the screen first, then the charger', () => {
    expect(pageTitle('/schedule', 'Garage', t)).toBe('<nav.charge_manager> – Garage')
    expect(pageTitle('/monitoring', 'Garage', t)).toBe('<nav.monitoring> – Garage')
    expect(pageTitle('/monitoring/health', 'Garage', t)).toBe('<nav.monitoring> – Garage')
    expect(pageTitle('/history', 'Garage', t)).toBe('<nav.history> – Garage')
    expect(pageTitle('/settings', 'Garage', t)).toBe('<nav.settings> – Garage')
  })

  it('names a settings page by its own title', () => {
    expect(pageTitle('/settings/mqtt', 'Garage', t)).toBe('<config.pages.mqtt> – Garage')
  })

  it('says a path that matches nothing was not found', () => {
    expect(pageTitle('/nope', 'Garage', t)).toBe('<screen.notfound> – Garage')
  })
})
