// src/routes/settings/__tests__/Shaper.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'
import { get } from 'svelte/store'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})
vi.mock('../../../lib/api/httpAPI', () => ({ httpAPI: vi.fn(() => Promise.resolve({ msg: 'done' })) }))

import { httpAPI } from '../../../lib/api/httpAPI'
import { config_store } from '../../../lib/stores/config'
import { status_store } from '../../../lib/stores/status'
import { uistates_store } from '../../../lib/stores/uistates'
import Shaper from '../Shaper.svelte'

beforeEach(() => {
  uistates_store.resetAlertBox()
  httpAPI.mockReset()
  httpAPI.mockResolvedValue({ msg: 'done' })
  status_store.set({ shaper_updated: true, shaper_live_pwr: 0, shaper_cur: 0 })
})

describe('Shaper page', () => {
  it('shows the settings expanded by default (no enable switch)', () => {
    config_store.set({ current_shaper_enabled: false })
    const { getByText, queryByText } = render(Shaper)
    expect(getByText('config.shaper.max_power')).toBeInTheDocument()
    expect(queryByText('config.shaper.enable')).not.toBeInTheDocument()
  })

  it('links to the Charge Manager to enable/schedule grid shaping', () => {
    config_store.set({ current_shaper_enabled: false })
    const { getByText } = render(Shaper)
    const link = getByText('config.add_in_charge_manager', { exact: false }).closest('a')
    expect(link).toHaveAttribute('href', '#/schedule')
  })

  it('saves the max-power field on blur', async () => {
    config_store.set({ current_shaper_enabled: true, current_shaper_max_pwr: 5000 })
    const { getByDisplayValue } = render(Shaper)
    const input = getByDisplayValue('5000')
    await fireEvent.input(input, { target: { value: '9000' } })
    await fireEvent.blur(input)
    expect(httpAPI).toHaveBeenCalledWith('POST', '/config', JSON.stringify({ current_shaper_max_pwr: 9000 }))
  })

  it('surfaces the write-error alert on a failed save', async () => {
    httpAPI.mockResolvedValue('error')
    config_store.set({ current_shaper_enabled: true, current_shaper_max_pwr: 5000 })
    const { getByDisplayValue } = render(Shaper)
    const input = getByDisplayValue('5000')
    await fireEvent.input(input, { target: { value: '9000' } })
    await fireEvent.blur(input)
    await vi.waitFor(() => {
      expect(get(uistates_store).alertbox.visible).toBe(true)
    })
  })

  // NumberInput emits null when a field is cleared to empty; every one of
  // these is shown blank (no numeric fallback), so clearing must not write
  // a literal null.
  it('does not save null for a shaper field cleared to empty', async () => {
    config_store.set({
      current_shaper_enabled: true, current_shaper_max_pwr: 9000,
      current_shaper_min_pause_time: 5, current_shaper_data_maxinterval: 120,
      current_shaper_smoothing_time: 60,
    })
    const { getAllByRole } = render(Shaper)
    const keys = ['current_shaper_max_pwr', 'current_shaper_min_pause_time', 'current_shaper_data_maxinterval', 'current_shaper_smoothing_time']
    const numbers = getAllByRole('spinbutton')
    for (const [i, key] of keys.entries()) {
      httpAPI.mockClear()
      await fireEvent.input(numbers[i], { target: { value: '' } })
      await fireEvent.blur(numbers[i])
      expect(httpAPI).not.toHaveBeenCalledWith('POST', '/config', expect.stringContaining(key))
    }
  })
})
