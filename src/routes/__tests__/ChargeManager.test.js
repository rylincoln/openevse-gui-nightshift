// The Charge Manager's Default limit card: what saving and removing it ask
// the charger, and in what order.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  // Interpolated names show, so each card's buttons can be told apart.
  const t = (k, o) => (o?.values ? `${k}(${Object.values(o.values).join(',')})` : k)
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t, locale: { subscribe: (fn) => { fn('en'); return () => {} } } }
})
vi.mock('../../lib/api/httpAPI', async (importOriginal) => ({
  ...(await importOriginal()),
  httpAPI: vi.fn(),
}))

import { httpAPI } from '../../lib/api/httpAPI'
import { config_store } from '../../lib/stores/config'
import { limit_store } from '../../lib/stores/limit'
import { override_store } from '../../lib/stores/override'
import { schedule_store } from '../../lib/stores/schedule'
import { status_store } from '../../lib/stores/status'
import ChargeManager from '../ChargeManager.svelte'

const writes = () => httpAPI.mock.calls.filter(([m]) => m !== 'GET').map(([m, u, body]) => [m, u, body])
// Let a flow run to its end, so a write it should not make would have landed.
const settled = async () => { for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0)) }

beforeEach(() => {
  httpAPI.mockReset()
  httpAPI.mockResolvedValue({ msg: 'done' })
  status_store.set({ state: 1 })
  schedule_store.set([])
  config_store.set({ max_current_soft: 32, limit_default_type: 'time', limit_default_value: 120 })
  limit_store.set({ type: 'time', value: 120, auto_release: false })
  override_store.set({ charge_current: 20, auto_release: false })
})

describe('the Default limit', () => {
  it('is removed config first, then the limit it applied, and the charge rate is left alone', async () => {
    render(ChargeManager)
    await fireEvent.click(screen.getByRole('button', {
      name: 'charge_manager.feature_remove_named(charge_manager.feature_session_limit)',
    }))
    await fireEvent.click(screen.getByRole('button', { name: 'charge_manager.feature_remove_confirm' }))
    await settled()
    expect(writes()).toEqual([
      ['POST', '/config', JSON.stringify({ limit_default_type: 'none' })],
      ['DELETE', '/limit', undefined],
    ])
  })

  it('is saved as one config write, type and value together', async () => {
    render(ChargeManager)
    await fireEvent.click(screen.getByRole('button', {
      name: 'charge_manager.feature_edit_named(charge_manager.feature_session_limit)',
    }))
    await fireEvent.click(screen.getByRole('button', { name: 'charge_manager.rule_save' }))
    await settled()
    expect(writes()).toEqual([
      ['POST', '/config', JSON.stringify({ limit_default_type: 'time', limit_default_value: 120 })],
    ])
  })
})
