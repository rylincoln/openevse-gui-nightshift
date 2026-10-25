import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import PowerRing from '../PowerRing.svelte'

describe('PowerRing', () => {
  it('shows kW when charging', () => {
    const { getByText } = render(PowerRing, {
      props: { display: 'charging', fill: 0.6, kw: '7.4', maxKw: '11.5' },
    })
    expect(getByText('7.4')).toBeInTheDocument()
  })
  // The ring's word is the status line's headline; the why lives in the line.
  it.each([
    ['idle', 'dashboard.line.ready'],
    ['connected', 'dashboard.line.connected'],
    ['sleeping', 'dashboard.line.paused'],
    ['off', 'dashboard.line.off'],
    ['error', 'dashboard.line.fault'],
    ['starting', 'dashboard.line.starting'],
  ])('names the %s state in the glossary\'s words', (display, key) => {
    const { getByText } = render(PowerRing, { props: { display } })
    expect(getByText(key)).toBeInTheDocument()
  })
  it('does not call a connected car that is not drawing power paused', () => {
    const { queryByText, container } = render(PowerRing, { props: { display: 'connected' } })
    expect(queryByText('dashboard.line.paused')).not.toBeInTheDocument()
    expect(container.innerHTML).not.toContain('var(--warning)')
  })
})
