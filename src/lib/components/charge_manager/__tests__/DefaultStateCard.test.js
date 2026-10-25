import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import DefaultStateCard from '../DefaultStateCard.svelte'

describe('DefaultStateCard', () => {
  it('labels the slider as the default charge rate', () => {
    const { getByRole, getByText } = render(DefaultStateCard, { props: { current: 32, maxCurrent: 48 } })
    expect(getByRole('slider', { name: 'charge_manager.current' })).toBeInTheDocument()
    expect(getByText('charge_manager.current')).toBeInTheDocument()
  })

  it('says in words whether heartbeat and boot lock are on', () => {
    const { getByText } = render(DefaultStateCard, {
      props: { heartbeatSupported: true, heartbeatActive: true, bootLockSupported: true, bootLock: false },
    })
    expect(getByText('charge_manager.heartbeat_on')).toBeInTheDocument()
    expect(getByText('charge_manager.boot_lock_off')).toBeInTheDocument()
  })

  it('says nothing about features the controller lacks', () => {
    const { queryByText } = render(DefaultStateCard, { props: { heartbeatSupported: false, bootLockSupported: false } })
    expect(queryByText(/heartbeat|boot_lock/)).toBeNull()
  })
})
