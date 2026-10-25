import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'
import Slider from '../Slider.svelte'

describe('Slider', () => {
  // The track draws 8 px tall; the input around it takes taps over 44.
  it('takes taps over a 44 px band around its track', () => {
    const { getByRole } = render(Slider, { props: { min: 0, max: 10, value: 5 } })
    expect(getByRole('slider').className).toMatch(/\b(?:tap-target|min-h-11|range-input)\b/)
  })
  it('renders a range input with min/max/value', () => {
    const { getByRole } = render(Slider, { props: { min: 6, max: 48, value: 24 } })
    const input = getByRole('slider')
    expect(input.min).toBe('6')
    expect(input.max).toBe('48')
    expect(input.value).toBe('24')
  })
  it('calls oninput with the numeric value while dragging', async () => {
    const oninput = vi.fn()
    const { getByRole } = render(Slider, { props: { min: 6, max: 48, value: 24, oninput } })
    const input = getByRole('slider')
    input.value = '30'
    await fireEvent.input(input)
    expect(oninput).toHaveBeenCalledWith(30)
  })
  it('calls onchange with the numeric value on change', async () => {
    const onchange = vi.fn()
    const { getByRole } = render(Slider, { props: { min: 6, max: 48, value: 24, onchange } })
    const input = getByRole('slider')
    input.value = '32'
    await fireEvent.change(input)
    expect(onchange).toHaveBeenCalledWith(32)
  })

  // Screen readers read aria-valuetext in place of the bare number.
  it('announces the formatted value', async () => {
    const { getByRole } = render(Slider, { props: { value: 47, max: 48, format: (v) => `${v} A`, ariaLabel: 'Rate' } })
    const slider = getByRole('slider', { name: 'Rate' })
    expect(slider).toHaveAttribute('aria-valuetext', '47 A')
    slider.value = '20'
    await fireEvent.input(slider)
    expect(slider).toHaveAttribute('aria-valuetext', '20 A')
  })
})
