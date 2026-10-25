import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, within } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k, opts) => (opts?.values ? k + ':' + JSON.stringify(opts.values) : k)
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import GlobalFeatureCard from '../GlobalFeatureCard.svelte'

describe('GlobalFeatureCard', () => {
  it('names its edit and remove buttons after the feature', () => {
    const { getByRole } = render(GlobalFeatureCard, { props: { featureKey: 'shaping' } })
    expect(getByRole('button', { name: 'charge_manager.feature_edit_named:{"feature":"charge_manager.feature_shaping"}' })).toBeInTheDocument()
    expect(getByRole('button', { name: 'charge_manager.feature_remove_named:{"feature":"charge_manager.feature_shaping"}' })).toBeInTheDocument()
  })

  it('asks before removing the feature', async () => {
    const onremove = vi.fn()
    const { getByRole } = render(GlobalFeatureCard, { props: { featureKey: 'rfid', onremove } })
    await fireEvent.click(getByRole('button', { name: /^charge_manager\.feature_remove_named/ }))
    const dialog = getByRole('alertdialog', {
      name: 'charge_manager.feature_remove_title:{"feature":"charge_manager.feature_rfid"}',
    })
    expect(dialog).toHaveAccessibleDescription('charge_manager.feature_remove_body')
    expect(onremove).not.toHaveBeenCalled()
    await fireEvent.click(within(dialog).getByText('charge_manager.feature_remove_confirm'))
    expect(onremove).toHaveBeenCalledOnce()
  })
})
