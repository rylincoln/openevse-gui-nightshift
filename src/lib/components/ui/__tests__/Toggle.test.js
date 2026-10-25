import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'
import Toggle from '../Toggle.svelte'

describe('Toggle', () => {
  it('takes taps over 44 px though it draws smaller', () => {
    const { getByRole } = render(Toggle, { props: { label: 'x' } })
    expect(getByRole('switch').className).toMatch(/\b(?:tap-target|min-h-11|range-input)\b/)
  })
  it('reflects checked state via aria-checked', () => {
    const { getByRole } = render(Toggle, { props: { checked: true, label: 'Eco' } })
    expect(getByRole('switch').getAttribute('aria-checked')).toBe('true')
  })
  it('calls onchange with the toggled value', async () => {
    const onchange = vi.fn()
    const { getByRole } = render(Toggle, { props: { checked: false, label: 'Eco', onchange } })
    await fireEvent.click(getByRole('switch'))
    expect(onchange).toHaveBeenCalledWith(true)
  })
})
