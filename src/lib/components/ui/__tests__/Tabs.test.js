import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'
import Tabs from '../Tabs.svelte'

const tabs = [
  { label: 'Data', alert: false },
  { label: 'Safety', alert: true },
  { label: 'Manager', alert: false },
]

describe('Tabs', () => {
  it('renders a tab per entry and marks the active one', () => {
    const { getAllByRole } = render(Tabs, { props: { tabs, active: 1 } })
    const els = getAllByRole('tab')
    expect(els).toHaveLength(3)
    expect(els[1].getAttribute('aria-selected')).toBe('true')
    expect(els[0].getAttribute('aria-selected')).toBe('false')
  })
  it('fires onchange with the clicked index', async () => {
    const onchange = vi.fn()
    const { getByText } = render(Tabs, { props: { tabs, active: 0, onchange } })
    await fireEvent.click(getByText('Manager'))
    expect(onchange).toHaveBeenCalledWith(2)
  })
  it('shows an alert dot only on tabs with alert set', () => {
    const { getAllByRole } = render(Tabs, { props: { tabs, active: 0 } })
    const els = getAllByRole('tab')
    expect(els[0].querySelector('span')).toBe(null)
    expect(els[1].querySelector('span')).not.toBe(null)
  })

  // Page tabs navigate; the charge-mode control changes the charger. They
  // must not look alike, so page tabs are underlined, never filled.
  it('draws page tabs as underlined navigation, not a filled segmented control', () => {
    const { getAllByRole } = render(Tabs, { props: { tabs, active: 1 } })
    const active = getAllByRole('tab')[1]
    expect(active.className).not.toMatch(/\bbg-accent\b/)
    expect(active.className).toMatch(/\bborder-accent\b/)
  })

  it('moves between tabs with the arrow keys, one tab stop for the row', async () => {
    const onchange = vi.fn()
    const { getAllByRole } = render(Tabs, { props: { tabs, active: 1, onchange } })
    const els = getAllByRole('tab')
    expect(els.map((e) => e.getAttribute('tabindex'))).toEqual(['-1', '0', '-1'])
    await fireEvent.keyDown(els[1], { key: 'ArrowRight' })
    expect(onchange).toHaveBeenLastCalledWith(2)
    await fireEvent.keyDown(els[1], { key: 'ArrowLeft' })
    expect(onchange).toHaveBeenLastCalledWith(0)
    await fireEvent.keyDown(els[0], { key: 'ArrowLeft' })
    expect(onchange).toHaveBeenLastCalledWith(2)
    await fireEvent.keyDown(els[1], { key: 'Home' })
    expect(onchange).toHaveBeenLastCalledWith(0)
    await fireEvent.keyDown(els[1], { key: 'End' })
    expect(onchange).toHaveBeenLastCalledWith(2)
  })
})
