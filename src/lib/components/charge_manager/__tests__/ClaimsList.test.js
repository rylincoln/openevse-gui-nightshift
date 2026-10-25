import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k, opts) => (opts?.values ? k + ':' + JSON.stringify(opts.values) : k)
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import ClaimsList from '../ClaimsList.svelte'

const MANUAL = 65537

describe('ClaimsList', () => {
  it('says the charger follows its defaults when nothing claims it', () => {
    const { getByText } = render(ClaimsList, { props: { rows: [] } })
    expect(getByText('charge_manager.claims.empty')).toBeInTheDocument()
  })

  it('names each setting, its value and who sets it', () => {
    const rows = [
      { property: 'state', clientId: MANUAL, value: 'disabled', priority: 1000 },
      { property: 'charge_current', clientId: MANUAL, value: 32, priority: 1000 },
    ]
    const { getByText, getAllByText } = render(ClaimsList, { props: { rows } })
    expect(getByText('charge_manager.claims.state')).toBeInTheDocument()
    expect(getByText('charge_manager.claims.off')).toBeInTheDocument()
    expect(getByText('charge_manager.claims.charge_current')).toBeInTheDocument()
    expect(getByText('32 A')).toBeInTheDocument()
    expect(getAllByText('charge_manager.claims.set_by:{"client":"clients.manual"}')).toHaveLength(2)
  })

  it('shows a current cap in amps', () => {
    const rows = [{ property: 'max_current', clientId: 65548, value: 24, priority: 500 }]
    const { getByText } = render(ClaimsList, { props: { rows } })
    expect(getByText('charge_manager.claims.max_current')).toBeInTheDocument()
    expect(getByText('24 A')).toBeInTheDocument()
  })

  it('says the default applies when no client claims a setting', () => {
    const rows = [{ property: 'state', clientId: 0, value: 'active', priority: 0 }]
    const { getByText } = render(ClaimsList, { props: { rows } })
    expect(getByText('charge_manager.claims.allowed')).toBeInTheDocument()
    expect(getByText('charge_manager.claims.set_by_default')).toBeInTheDocument()
  })

  it('leaves out the internal priority numbers', () => {
    const rows = [{ property: 'state', clientId: MANUAL, value: 'disabled', priority: 1000 }]
    const { container } = render(ClaimsList, { props: { rows } })
    expect(container.textContent).not.toMatch(/priority|1000/)
  })
})
