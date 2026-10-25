import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/svelte'
import ProgressRing from '../ProgressRing.svelte'

// The conic-gradient now lives on a dedicated ring layer (the first
// child of the wrapper). The wrapper itself only carries size.
const ringLayer = (container) => container.firstElementChild.firstElementChild

describe('ProgressRing', () => {
  it('renders a conic-gradient sized by fill (0.5 -> 180deg)', () => {
    const { container } = render(ProgressRing, { props: { fill: 0.5 } })
    expect(ringLayer(container).getAttribute('style')).toContain('180deg')
  })
  it('clamps fill above 1 to 360deg', () => {
    const { container } = render(ProgressRing, { props: { fill: 5 } })
    expect(ringLayer(container).getAttribute('style')).toContain('360deg')
  })
  it('omits the breathe animation by default', () => {
    const { container } = render(ProgressRing, { props: { fill: 0.5 } })
    expect(ringLayer(container).classList.contains('breathe')).toBe(false)
  })
  // Through the .breathe class, which stops under prefers-reduced-motion; an
  // inline animation ran regardless.
  it('breathes through the reduced-motion-aware class when pulse is true', () => {
    const { container } = render(ProgressRing, { props: { fill: 0.5, pulse: true } })
    expect(ringLayer(container).classList.contains('breathe')).toBe(true)
    expect(ringLayer(container).getAttribute('style')).not.toContain('animation')
  })
})
