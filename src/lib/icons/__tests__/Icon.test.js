import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/svelte'
import Icon from '../Icon.svelte'

// Icons decorate a label beside them, or sit in a control that carries the
// name; announced on their own they were a stream of unnamed "image"s.
describe('Icon', () => {
  it('is hidden from assistive technology', () => {
    const { container } = render(Icon, { props: { icon: 'mdi:flash' } })
    expect(container.querySelector('iconify-icon').getAttribute('aria-hidden')).toBe('true')
  })
})
