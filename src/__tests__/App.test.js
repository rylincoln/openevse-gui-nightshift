import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  const isLoading = { subscribe: (fn) => { fn(false); return () => {} } }
  return { _: t, isLoading, register: vi.fn(), init: vi.fn(), getLocaleFromNavigator: () => 'en' }
})
vi.mock('../lib/api/httpAPI', () => ({ httpAPI: vi.fn(() => Promise.resolve('error')) }))

import App from '../App.svelte'

describe('App', () => {
  it('renders the loader before data has loaded', () => {
    const { container } = render(App)
    // Loader covers the screen; the BottomNav (a <nav>) is not present yet.
    expect(container.querySelector('nav')).not.toBeInTheDocument()
  })

  it('replaces the loader with the load-failure dialog when boot fails', async () => {
    render(App)
    // httpAPI is mocked to fail, so the first store download fails. The
    // loader has to go: left up, it covers the alert, the only way out.
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('connection.load_failed')
    expect(dialog).toHaveTextContent('connection.load_failed_body')
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })
})
