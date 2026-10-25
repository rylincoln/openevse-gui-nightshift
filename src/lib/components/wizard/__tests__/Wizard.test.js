// src/lib/components/wizard/__tests__/Wizard.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

// Each step pulls in real stores / form helpers / http — stub them so the
// route renders without an exploded dependency graph. vi.mock is hoisted,
// so the spy has to live inside vi.hoisted to be reachable from the factory.
const { upload } = vi.hoisted(() => ({
  upload: vi.fn(() => Promise.resolve(true)),
}))
vi.mock('../../../stores/config', async () => {
  const { writable } = await import('svelte/store')
  const config_store = writable({ wizard_passed: false, hostname: 'openevse' })
  return { config_store: Object.assign(config_store, { upload }) }
})
vi.mock('../../../api/httpAPI', async (importOriginal) => ({
  ...(await importOriginal()),
  httpAPI: vi.fn(() => Promise.resolve([])),
}))

import { get } from 'svelte/store'
import { status_store } from '../../../stores/status'
import { config_store } from '../../../stores/config'
import { uistates_store } from '../../../stores/uistates'

import Wizard from '../../../../routes/Wizard.svelte'

beforeEach(() => {
  upload.mockReset()
  upload.mockResolvedValue(true)
  uistates_store.resetAlertBox()
  status_store.set({ ipaddress: '10.0.0.5' })
  // Saving credentials writes into the store; don't let it seed the next test.
  config_store.set({ wizard_passed: false, hostname: 'openevse' })
})

describe('Wizard route', () => {
  it('starts on the welcome step', () => {
    const { getByText } = render(Wizard)
    expect(getByText('wizard.welcome.title')).toBeInTheDocument()
    expect(getByText('wizard.step_count')).toBeInTheDocument()
  })

  it('advances and rewinds with Next / Previous', async () => {
    const { getByText, queryByText } = render(Wizard)
    expect(getByText('wizard.welcome.title')).toBeInTheDocument()

    await fireEvent.click(getByText('wizard.next'))
    expect(getByText('wizard.evse.title')).toBeInTheDocument()

    await fireEvent.click(getByText('wizard.previous'))
    expect(getByText('wizard.welcome.title')).toBeInTheDocument()
    expect(queryByText('wizard.previous')).toBeNull()
  })

  it('shows the max current value while the slider is dragged', async () => {
    const { getByText, getByRole } = render(Wizard)
    await fireEvent.click(getByText('wizard.next'))

    const slider = getByRole('slider')
    slider.value = '20'
    await fireEvent.input(slider)

    expect(getByText('20 A')).toBeInTheDocument()
  })

  it('holds the EVSE step and shows a comms error when the safety module is unreachable', async () => {
    // Firmware publishes evse_connected as 0 when the WiFi module can't reach
    // the EVSE controller over serial (gui-nightshift#17).
    status_store.set({ ipaddress: '10.0.0.5', evse_connected: 0 })
    const { getByText, queryByRole, queryByText } = render(Wizard)

    await fireEvent.click(getByText('wizard.next')) // -> EVSE step

    // The error is surfaced and the (untrustworthy) controls are hidden.
    expect(getByText('connection.evse_missing')).toBeInTheDocument()
    expect(queryByRole('slider')).toBeNull()
    // No bypass hint until the user actually tries to advance.
    expect(queryByText('wizard.evse.bypass_hint')).toBeNull()

    // A single Next tap can't blindly continue past setup — it holds and
    // reveals the tap-to-skip hint instead.
    await fireEvent.click(getByText('wizard.next'))
    expect(getByText('wizard.evse.title')).toBeInTheDocument()
    expect(getByText('wizard.evse.bypass_hint')).toBeInTheDocument()
  })

  it('lets a determined user tap Next three times to skip the EVSE comms block', async () => {
    status_store.set({ ipaddress: '10.0.0.5', evse_connected: 0 })
    const { getByText } = render(Wizard)

    await fireEvent.click(getByText('wizard.next')) // -> EVSE step
    await fireEvent.click(getByText('wizard.next')) // tap 1 — holds
    expect(getByText('wizard.evse.title')).toBeInTheDocument()
    await fireEvent.click(getByText('wizard.next')) // tap 2 — holds
    expect(getByText('wizard.evse.title')).toBeInTheDocument()
    await fireEvent.click(getByText('wizard.next')) // tap 3 — breaks through
    expect(getByText('wizard.time.title')).toBeInTheDocument()
  })

  it('resets the bypass tap count when the EVSE step is revisited', async () => {
    status_store.set({ ipaddress: '10.0.0.5', evse_connected: 0 })
    const { getByText } = render(Wizard)

    await fireEvent.click(getByText('wizard.next')) // -> EVSE step
    await fireEvent.click(getByText('wizard.next')) // tap 1
    await fireEvent.click(getByText('wizard.next')) // tap 2
    await fireEvent.click(getByText('wizard.previous')) // back to welcome — resets
    await fireEvent.click(getByText('wizard.next')) // -> EVSE step again

    // Prior taps were cleared: one tap here must not break through.
    await fireEvent.click(getByText('wizard.next')) // tap 1 of a fresh count
    expect(getByText('wizard.evse.title')).toBeInTheDocument()
  })

  it('allows advancing past the EVSE step when the controller is reachable', async () => {
    status_store.set({ ipaddress: '10.0.0.5', evse_connected: 1 })
    const { getByText, getByRole } = render(Wizard)

    await fireEvent.click(getByText('wizard.next')) // -> EVSE step
    expect(getByRole('slider')).toBeInTheDocument()

    await fireEvent.click(getByText('wizard.next')) // -> Time step (WiFi is now last)
    expect(getByText('wizard.time.title')).toBeInTheDocument()
  })

  // WiFi is the final step now: reaching it and connecting is what completes
  // setup. markComplete writes wizard_passed BEFORE the join (the join drops the
  // AP), and the reconnect dialog only shows when we're still on the device AP.
  async function joinFromWifiStep(view, ssid = 'Home', pass = '') {
    const { getByText, getByLabelText } = view
    // welcome -> evse -> time -> security -> firmware -> wifi (5 taps)
    for (let i = 0; i < 5; i++) await fireEvent.click(getByText('wizard.next'))
    await fireEvent.click(getByText('config.network.manual'))
    await fireEvent.input(getByLabelText('config.network.ssid'), {
      target: { value: ssid },
    })
    if (pass) {
      await fireEvent.input(getByLabelText('config.network.wifi_password'), {
        target: { value: pass },
      })
    }
    await fireEvent.click(getByText('config.network.connect'))
  }

  it('writes wizard_passed, and is done, when joining from the home network', async () => {
    status_store.set({ ipaddress: '10.0.0.5' })
    const ondone = vi.fn()
    const view = render(Wizard, { ondone })
    await joinFromWifiStep(view)

    // Already routable: App.svelte swaps to the dashboard, no reconnect prompt.
    await vi.waitFor(() => expect(ondone).toHaveBeenCalled())
    expect(upload).toHaveBeenCalledWith({ wizard_passed: true })
    expect(view.queryByText('wizard.reconnect.title')).toBeNull()
  })

  // This page is about to lose the charger; it stays on what to do next.
  it('shows the reconnect dialog, and stays, when joining while still on the device AP', async () => {
    status_store.set({ ipaddress: '192.168.4.1' })
    const ondone = vi.fn()
    const view = render(Wizard, { ondone })
    await joinFromWifiStep(view)

    expect(await view.findByText('wizard.reconnect.title')).toBeInTheDocument()
    expect(upload).toHaveBeenCalledWith({ wizard_passed: true })
    await fireEvent.click(view.getByText('wizard.reconnect.dismiss'))
    expect(ondone).not.toHaveBeenCalled()
  })

  it('can join a network entered manually when scanning finds nothing', async () => {
    const view = render(Wizard)
    await joinFromWifiStep(view, 'Hidden network', 'secret')

    await vi.waitFor(() => {
      expect(upload).toHaveBeenCalledWith({ ssid: 'Hidden network', pass: 'secret' })
    })
  })

  it('says so when the charger refuses to record that setup is done', async () => {
    upload.mockImplementation((data) => Promise.resolve(!('wizard_passed' in data)))
    const view = render(Wizard)
    await joinFromWifiStep(view)
    await vi.waitFor(() => expect(get(uistates_store).alertbox.visible).toBe(true))
  })

  // The charger may already be on the home network (set up before, or by
  // WPS): joining again must not be the only way to finish.
  it('offers to keep the current network and finish when the charger is already on WiFi', async () => {
    status_store.set({ ipaddress: '10.0.0.5', mode: 'STA', ssid: 'Home', wifi_client_connected: 1 })
    const { getByText, queryByText } = render(Wizard)
    for (let i = 0; i < 5; i++) await fireEvent.click(getByText('wizard.next'))
    expect(getByText('wizard.wifi.current')).toBeInTheDocument()
    await fireEvent.click(getByText('wizard.wifi.keep'))
    await vi.waitFor(() => {
      expect(upload).toHaveBeenCalledWith({ wizard_passed: true })
    })
    expect(upload.mock.calls).toEqual([[{ wizard_passed: true }]])
    expect(queryByText('wizard.reconnect.title')).toBeNull()
  })

  it('keeps the network from the setup hotspot, then says where to reconnect', async () => {
    status_store.set({ ipaddress: '192.168.4.1', mode: 'STA+AP', ssid: 'Home', wifi_client_connected: 1 })
    const { getByText } = render(Wizard)
    for (let i = 0; i < 5; i++) await fireEvent.click(getByText('wizard.next'))
    await fireEvent.click(getByText('wizard.wifi.keep'))
    await vi.waitFor(() => {
      expect(getByText('wizard.reconnect.title')).toBeInTheDocument()
    })
  })

  it("only warns about losing the connection on the charger's own hotspot", async () => {
    status_store.set({ ipaddress: '10.0.0.5', mode: 'AP' })
    const home = render(Wizard)
    for (let i = 0; i < 5; i++) await fireEvent.click(home.getByText('wizard.next'))
    expect(home.queryByText('wizard.wifi.handoff_title')).toBeNull()
    home.unmount()

    status_store.set({ ipaddress: '192.168.4.1', mode: 'AP' })
    const ap = render(Wizard)
    for (let i = 0; i < 5; i++) await fireEvent.click(ap.getByText('wizard.next'))
    expect(ap.getByText('wizard.wifi.handoff_title')).toBeInTheDocument()
  })

  it('does not claim a saved network is joined when the charger is not on it', async () => {
    status_store.set({ ipaddress: '192.168.4.1', mode: 'STA+AP', ssid: '', wifi_client_connected: 0 })
    config_store.update((c) => ({ ...c, ssid: 'Home' }))
    const { getByText, queryByText } = render(Wizard)
    for (let i = 0; i < 5; i++) await fireEvent.click(getByText('wizard.next'))
    expect(queryByText('wizard.wifi.current')).toBeNull()
    expect(getByText('wizard.wifi.saved')).toBeInTheDocument()
    expect(queryByText('wizard.wifi.keep')).toBeNull()
  })

  // The password step has one way forward: Next saves what was typed.
  describe('password step', () => {
    async function toSecurity(view) {
      for (let i = 0; i < 3; i++) await fireEvent.click(view.getByText('wizard.next'))
      expect(view.getByText('wizard.security.title')).toBeInTheDocument()
    }
    async function type(view, label, value) {
      const input = view.getByLabelText(label)
      await fireEvent.input(input, { target: { value } })
      await fireEvent.blur(input)
    }

    it('has no separate save button competing with Next', async () => {
      const view = render(Wizard)
      await toSecurity(view)
      expect(view.queryByText('config.http.set_credentials')).toBeNull()
    })

    it('saves a typed username and password when Next is pressed', async () => {
      const view = render(Wizard)
      await toSecurity(view)
      await type(view, 'config.http.username', 'admin')
      await type(view, 'config.http.password', 'pw1234')
      await fireEvent.click(view.getByText('wizard.next'))
      await vi.waitFor(() => {
        expect(upload).toHaveBeenCalledWith({ www_username: 'admin', www_password: 'pw1234' })
      })
      await vi.waitFor(() => {
        expect(view.getByText('wizard.firmware.title')).toBeInTheDocument()
      })
    })

    it('stays put when a password is typed without a username', async () => {
      const view = render(Wizard)
      await toSecurity(view)
      await type(view, 'config.http.password', 'pw1234')
      await fireEvent.click(view.getByText('wizard.next'))
      expect(view.getByText('config.http.username_required')).toBeInTheDocument()
      expect(view.getByText('wizard.security.title')).toBeInTheDocument()
      expect(upload).not.toHaveBeenCalled()
    })

    it('skips when both fields are left blank', async () => {
      const view = render(Wizard)
      await toSecurity(view)
      await fireEvent.click(view.getByText('wizard.next'))
      await vi.waitFor(() => {
        expect(view.getByText('wizard.firmware.title')).toBeInTheDocument()
      })
      expect(upload).not.toHaveBeenCalled()
    })
  })

  // A charger already online over Ethernet doesn't need WiFi — the wizard
  // must offer a way out of the WiFi step other than joining a network.
  it('shows Finish (not a WiFi trap) on the WiFi step when Ethernet is connected', async () => {
    status_store.set({ ipaddress: '10.0.0.5', eth_connected: 1 })
    const { getByText, queryByText } = render(Wizard)

    for (let i = 0; i < 5; i++) await fireEvent.click(getByText('wizard.next'))
    expect(getByText('wizard.wifi.title')).toBeInTheDocument()
    expect(getByText('wizard.wifi.eth_title')).toBeInTheDocument()
    // The AP hand-off warning doesn't apply — there's no softAP to lose.
    expect(queryByText('wizard.wifi.handoff_title')).toBeNull()

    await fireEvent.click(getByText('wizard.finish'))

    await vi.waitFor(() => {
      expect(upload).toHaveBeenCalledWith({ wizard_passed: true })
    })
    expect(upload.mock.calls).toEqual([[{ wizard_passed: true }]])
  })
})
