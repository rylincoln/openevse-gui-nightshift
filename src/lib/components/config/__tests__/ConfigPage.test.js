// src/lib/components/config/__tests__/ConfigPage.test.js
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/svelte'
import { createRawSnippet } from 'svelte'

import { vi } from 'vitest'
vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import ConfigPage from '../ConfigPage.svelte'

const body = createRawSnippet(() => ({ render: () => `<p>page body</p>` }))

describe('ConfigPage', () => {
  it('takes taps on the back link over 44 px', () => {
    const { getByText } = render(ConfigPage, { title: 'Network', children: body })
    expect(getByText('config.back').closest('a').className).toMatch(/\b(?:tap-target|min-h-11|range-input)\b/)
  })
  it('renders the title and a back link to the hub', () => {
    const { getByText, getByRole } = render(ConfigPage, { title: 'Network', children: body })
    expect(getByText('Network')).toBeInTheDocument()
    expect(getByRole('link')).toHaveAttribute('href', '#/settings')
  })
  it('renders slotted content', () => {
    const { getByText } = render(ConfigPage, { title: 'Network', children: body })
    expect(getByText('page body')).toBeInTheDocument()
  })
  // The page shares every screen's width so the title doesn't move between
  // screens; the form itself stays a narrower column inside it.
  it('keeps the form a narrow column inside the shared page width on desktop', () => {
    const { container, getByText } = render(ConfigPage, { title: 'Network', children: body })
    const section = container.querySelector('section')
    expect(section.className).toContain('lg:max-w-5xl')
    expect(section.className).toContain('lg:mx-auto')
    const column = getByText('page body').closest('[class*="lg:max-w-2xl"]')
    expect(column).toBeTruthy()
    expect(column.querySelector('h1').textContent).toBe('Network')
  })
})
