import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, within } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k, opts) => (opts?.values ? k + ':' + JSON.stringify(opts.values) : k)
  t.subscribe = (fn) => { fn(t); return () => {} }
  const locale = { subscribe: (fn) => { fn('en'); return () => {} } }
  return { _: t, locale }
})

import RuleCard from '../RuleCard.svelte'

const rule = {
  id: 'r_1', action: 'eco_divert', days: ['monday'],
  startTime: '08:00', stopTime: '10:00', _startEventId: 1,
}

// Intl puts a narrow no-break space before AM/PM; compare on plain spaces.
const plain = (s) => s.replace(/\s/g, ' ')
const text = (container) => plain(container.textContent)

describe('RuleCard', () => {
  it('shows the in-effect badge when the rule is active', () => {
    const { getByText } = render(RuleCard, { props: { rule, active: true } })
    expect(getByText('charge_manager.active')).toBeInTheDocument()
  })
  it('hides the in-effect badge when the rule is not active', () => {
    const { queryByText } = render(RuleCard, { props: { rule, active: false } })
    expect(queryByText('charge_manager.active')).not.toBeInTheDocument()
  })

  it('shows its window in the locale’s clock', () => {
    const { container } = render(RuleCard, { props: { rule } })
    expect(text(container)).toContain('charge_manager.window:{"start":"8:00 AM","stop":"10:00 AM"}')
  })
  it('marks a window that ends the next day', () => {
    const { container } = render(RuleCard, { props: { rule: { ...rule, startTime: '23:00', stopTime: '06:00' } } })
    expect(text(container)).toContain('charge_manager.window_next_day:{"start":"11:00 PM","stop":"6:00 AM"}')
  })
  it('says an open-ended rule runs until the next rule', () => {
    const { container } = render(RuleCard, { props: { rule: { ...rule, stopTime: null } } })
    expect(text(container)).toContain('charge_manager.window_open:{"start":"8:00 AM"}')
  })

  it('puts the charge rate in the title', () => {
    const { getByText, queryByText } = render(RuleCard, {
      props: { rule: { ...rule, action: 'charge', chargeCurrent: 16 } },
    })
    expect(getByText('charge_manager.rule_title_rate:{"action":"charge_manager.rule_action_charge","amps":16}')).toBeInTheDocument()
    expect(queryByText('16 A')).toBeNull()
  })
  it('titles a rule without a rate by its action alone', () => {
    const { getByText } = render(RuleCard, { props: { rule: { ...rule, action: 'charge', chargeCurrent: null } } })
    expect(getByText('charge_manager.rule_action_charge')).toBeInTheDocument()
  })

  it('names its edit and delete buttons after the rule', () => {
    const { getAllByRole } = render(RuleCard, { props: { rule } })
    const names = getAllByRole('button').map((b) => plain(b.getAttribute('aria-label') ?? ''))
    const name = 'charge_manager.rule_action_eco_divert, days.monday, charge_manager.window:{"start":"8:00 AM","stop":"10:00 AM"}'
    expect(names).toContain(`charge_manager.rule_edit_named:${JSON.stringify({ rule: name })}`)
    expect(names).toContain(`charge_manager.rule_delete_named:${JSON.stringify({ rule: name })}`)
  })

  it('asks before deleting', async () => {
    const ondelete = vi.fn()
    const { getByRole } = render(RuleCard, { props: { rule, ondelete } })
    await fireEvent.click(getByRole('button', { name: /^charge_manager\.rule_delete_named/ }))
    const dialog = getByRole('alertdialog', { name: 'charge_manager.rule_delete_title' })
    expect(ondelete).not.toHaveBeenCalled()
    await fireEvent.click(within(dialog).getByText('charge_manager.rule_delete_confirm'))
    expect(ondelete).toHaveBeenCalledOnce()
  })
})
