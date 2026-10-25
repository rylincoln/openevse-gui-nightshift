import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k, opts) => (opts?.values ? k + ':' + JSON.stringify(opts.values) : k)
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import ConnectionBanners from '../ConnectionBanners.svelte'

describe('ConnectionBanners', () => {
  it('shows nothing when connected and healthy', () => {
    const { container } = render(ConnectionBanners, {
      props: { wsConnected: true, evseConnected: true, error: false },
    })
    expect(container.querySelectorAll('[role="alert"]')).toHaveLength(0)
  })

  it('shows the connection-lost banner when the websocket is down', () => {
    const { getAllByRole } = render(ConnectionBanners, {
      props: { wsConnected: false, evseConnected: true, error: false },
    })
    expect(getAllByRole('alert').length).toBeGreaterThan(0)
  })

  it('names the fault and points to what to do', () => {
    const { getByRole } = render(ConnectionBanners, {
      props: { error: true, fault: 'GFCI fault' },
    })
    expect(getByRole('alert')).toHaveTextContent('connection.fault:{"fault":"GFCI fault"}')
    expect(getByRole('link', { name: 'connection.fault_link' })).toHaveAttribute('href', '#/')
  })

  it('drops the link on the dashboard, which already says what to do', () => {
    const { queryByRole } = render(ConnectionBanners, {
      props: { error: true, fault: 'GFCI fault', onDashboard: true },
    })
    expect(queryByRole('link')).not.toBeInTheDocument()
  })
})
