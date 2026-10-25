import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/svelte'
import { tick } from 'svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  const isLoading = { subscribe: (fn) => { fn(false); return () => {} } }
  return { _: t, isLoading, register: vi.fn(), init: vi.fn(), getLocaleFromNavigator: () => 'en' }
})
vi.mock('../lib/api/httpAPI', async (importOriginal) => ({ ...(await importOriginal()), httpAPI: vi.fn(() => Promise.resolve('error')) }))

import { httpAPI } from '../lib/api/httpAPI'
import { showWriteError } from '../lib/alerts'
import { config_store } from '../lib/stores/config'
import App from '../App.svelte'

// A charger that has not been through setup: every boot download succeeds.
const UNPROVISIONED = {
  '/status': { state: 1 },
  '/schedule': [],
  '/schedule/plan': {},
  '/config': { wizard_passed: false },
  '/override': {},
  '/claims/target': { properties: {}, claims: {} },
  '/claims': [],
  '/certificates': [],
}

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

  // Setup writes to the charger too (WiFi, time, the charge rate); a refused
  // write must say so there as well.
  it('shows a failed write during setup', async () => {
    httpAPI.mockImplementation((_m, url) => Promise.resolve(UNPROVISIONED[url] ?? 'error'))
    render(App)
    await screen.findByText('wizard.welcome.heading')
    showWriteError()
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('alert.write_failed_body')
  })

  // The wizard writes wizard_passed before it joins WiFi, because the join
  // turns off the setup hotspot. The dashboard taking over at that write
  // would take the "reconnect at" dialog with it.
  it('keeps setup on screen after it writes wizard_passed, until it is finished', async () => {
    httpAPI.mockImplementation((_m, url) => Promise.resolve(UNPROVISIONED[url] ?? 'error'))
    render(App)
    await screen.findByText('wizard.welcome.heading')
    config_store.update((c) => ({ ...c, wizard_passed: true }))
    await tick()
    expect(screen.getByText('wizard.welcome.heading')).toBeInTheDocument()
  })
})
