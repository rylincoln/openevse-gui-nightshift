import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import RatePill from '../RatePill.svelte'

// The visible label and the value together name the button.
const pill = (getByRole) => getByRole('button', { name: /^dashboard\.rate\.label/ })

describe('RatePill', () => {
  it('labels the amps it shows as the charge rate', () => {
    const { getByRole } = render(RatePill, { props: { amps: 32, max: 48 } })
    expect(pill(getByRole)).toHaveAccessibleName('dashboard.rate.label 32 A')
  })

  it('says it opens a dialog, and whether it is open', async () => {
    const { getByRole } = render(RatePill, { props: { amps: 32, max: 48 } })
    expect(pill(getByRole)).toHaveAttribute('aria-haspopup', 'dialog')
    expect(pill(getByRole)).toHaveAttribute('aria-expanded', 'false')
    await fireEvent.click(pill(getByRole))
    expect(pill(getByRole)).toHaveAttribute('aria-expanded', 'true')
    expect(getByRole('dialog', { name: 'dashboard.rate.label' })).toBeInTheDocument()
  })

  it('opens the popover and emits onchange from the slider', async () => {
    const onchange = vi.fn()
    const { getByRole } = render(RatePill, { props: { amps: 24, max: 48, onchange } })
    await fireEvent.click(pill(getByRole))
    const slider = getByRole('slider', { name: 'dashboard.rate.label' })
    expect(slider).toHaveAttribute('aria-valuetext', '24 A')
    slider.value = '20'
    await fireEvent.change(slider)
    expect(onchange).toHaveBeenCalledWith(20)
  })

  it('tracks the drag value live in the header before release', async () => {
    const { getByRole, getAllByText, queryByText } = render(RatePill, { props: { amps: 25, max: 32 } })
    await fireEvent.click(pill(getByRole))
    const slider = getByRole('slider', { name: 'dashboard.rate.label' })
    slider.value = '18'
    await fireEvent.input(slider) // drag, no release yet
    // both the popover header and the pill button follow the drag
    expect(getAllByText('18 A')).toHaveLength(2)
    expect(queryByText('25 A')).toBeNull()
  })

  it('does not open when disabled', async () => {
    const { getByRole, queryByRole } = render(RatePill, { props: { amps: 24, max: 48, disabled: true } })
    await fireEvent.click(pill(getByRole))
    expect(queryByRole('slider')).not.toBeInTheDocument()
  })

  it('shows the claimed hint when claimedBy is set', async () => {
    const { getByRole, getByText } = render(RatePill, { props: { amps: 16, max: 48, claimedBy: 'Solar divert' } })
    await fireEvent.click(pill(getByRole))
    expect(getByText('dashboard.rate.claimed')).toBeInTheDocument()
  })

  it('says who is capping the rate', async () => {
    const { getByRole, getByText } = render(RatePill, {
      props: { amps: 32, max: 48, capText: 'Load shaper limits it to 24 A' },
    })
    await fireEvent.click(pill(getByRole))
    expect(getByText('Load shaper limits it to 24 A')).toBeInTheDocument()
  })
})
