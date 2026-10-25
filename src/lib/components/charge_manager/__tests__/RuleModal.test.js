import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  const locale = { subscribe: (fn) => { fn('en'); return () => {} } }
  return { _: t, locale }
})

import RuleModal from '../RuleModal.svelte'

const scheduled = {
  alwaysOn: false, action: 'charge', days: ['monday'], startTime: '08:00', stopTime: null,
  chargeCurrent: null, limit: null, _startEventId: null, _stopEventId: null,
}
// jsdom has no `inert`, so Svelte's property write doesn't reflect to the
// attribute there; look for the property on an ancestor instead.
const inInert = (el) => {
  for (let n = el; n; n = n.parentElement) if (n.inert === true) return true
  return false
}
const describedBy = (el) =>
  (el.getAttribute('aria-describedby') ?? '').split(' ').map((id) => document.getElementById(id)?.textContent?.trim())

describe('RuleModal', () => {
  it('titles a rule started from Add rule as new, and an existing one as an edit', () => {
    // Always-active features from the picker already carry their global_ id.
    const fresh = render(RuleModal, { props: { open: true, isNew: true, rule: { ...scheduled, id: 'global_rfid' } } })
    expect(fresh.getByRole('heading', { name: 'charge_manager.rule_new_title' })).toBeInTheDocument()
    fresh.unmount()
    const saved = render(RuleModal, { props: { open: true, rule: { ...scheduled, id: 'r_1' } } })
    expect(saved.getByRole('heading', { name: 'charge_manager.rule_edit_title' })).toBeInTheDocument()
  })

  it('takes the schedule out of reach while the rule is always active', () => {
    const { getByRole } = render(RuleModal, { props: { open: true, rule: null } })
    const days = getByRole('group', { name: 'charge_manager.rule_days', hidden: true })
    expect(inInert(days)).toBe(true)
  })

  it('leaves the schedule usable for a scheduled rule', () => {
    const { getByRole } = render(RuleModal, { props: { open: true, rule: scheduled } })
    expect(inInert(getByRole('group', { name: 'charge_manager.rule_days' }))).toBe(false)
  })

  it('names the action and limit selects', () => {
    const { getByRole } = render(RuleModal, { props: { open: true, rule: scheduled } })
    expect(getByRole('combobox', { name: 'charge_manager.rule_action' })).toBeInTheDocument()
    expect(getByRole('combobox', { name: 'charge_manager.rule_limit' })).toBeInTheDocument()
  })

  it('ties the no-day error to the day buttons', async () => {
    const { getByRole } = render(RuleModal, { props: { open: true, rule: { ...scheduled, days: [] } } })
    await fireEvent.click(getByRole('button', { name: 'charge_manager.rule_save' }))
    const days = getByRole('group', { name: 'charge_manager.rule_days' })
    expect(describedBy(days)).toContain('charge_manager.rule_error_no_day')
    expect(getByRole('alert')).toHaveTextContent('charge_manager.rule_error_no_day')
  })

  it('ties the same-time error to the stop time', async () => {
    const { getByRole, getByLabelText } = render(RuleModal, {
      props: { open: true, rule: { ...scheduled, startTime: '08:00', stopTime: '08:00' } },
    })
    await fireEvent.click(getByRole('button', { name: 'charge_manager.rule_save' }))
    const stop = getByLabelText(/charge_manager\.rule_stop_time/)
    expect(stop).toHaveAttribute('aria-invalid', 'true')
    expect(describedBy(stop)).toContain('charge_manager.rule_error_same_time')
  })

  it('ties the missing-limit error to the limit select', async () => {
    const { getByRole } = render(RuleModal, { props: { open: true, rule: null } })
    await fireEvent.click(getByRole('button', { name: 'charge_manager.rule_save' }))
    const limit = getByRole('combobox', { name: 'charge_manager.rule_limit' })
    expect(limit).toHaveAttribute('aria-invalid', 'true')
    expect(describedBy(limit)).toContain('charge_manager.rule_error_no_limit')
  })
})
