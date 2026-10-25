import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, within } from '@testing-library/svelte'
import { get } from 'svelte/store'

vi.mock('svelte-i18n', () => {
  // Keys come back as-is, except that client names and the lines naming a
  // client show which name they were given, so a raw internal key would show.
  const t = (k, o) =>
    k.startsWith('clients.') ? `name:${k.slice(8)}` : o?.values?.client ? `${k}(${o.values.client})` : k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t, locale: { subscribe: (fn) => { fn('en'); return () => {} } } }
})
vi.mock('../../lib/api/httpAPI', async (importOriginal) => ({
  ...(await importOriginal()),
  httpAPI: vi.fn(() => Promise.resolve({})),
}))

import { httpAPI } from '../../lib/api/httpAPI'
import { status_store } from '../../lib/stores/status'
import { config_store } from '../../lib/stores/config'
import { claims_target_store } from '../../lib/stores/claims_target'
import { override_store } from '../../lib/stores/override'
import { uistates_store } from '../../lib/stores/uistates'
import { uisettings_store } from '../../lib/stores/uisettings'
import { limit_store } from '../../lib/stores/limit'
import { EvseClients } from '../../lib/vars'
import Dashboard from '../Dashboard.svelte'

describe('Dashboard', () => {
  beforeEach(() => {
    config_store.set({ max_current_soft: 48, divert_enabled: false, current_shaper_enabled: false })
    claims_target_store.set({ properties: {}, claims: { state: null } })
    override_store.set(undefined)
    uistates_store.resetAlertBox()
    httpAPI.mockReset()
    httpAPI.mockResolvedValue({})
    limit_store.set({ type: 'none', value: 0, auto_release: true })
    // Load sharing is Labs-gated; default it off so unrelated tests are
    // deterministic. The load-sharing cases opt in explicitly.
    config_store.update((c) => ({ ...c, labs_enabled: false }))
  })

  // The status line: what the charger is doing and why, in one spot above
  // either hero.
  const statusLine = (container) => within(container.querySelector('[data-status-line]'))

  // Every other screen has an h1; Home's gives the outline its top.
  it('has a level-one heading', () => {
    status_store.set({ state: 1 })
    const { getByRole } = render(Dashboard)
    expect(getByRole('heading', { level: 1, name: 'nav.home' })).toBeInTheDocument()
  })

  it('says it is charging, and why, when state is 3', () => {
    status_store.set({ state: 3, power: 7000, voltage: 240, amp: 32000, session_energy: 12300, session_elapsed: 6129, temp: 427, pilot: 32, max_current: 48 })
    const { container } = render(Dashboard)
    expect(statusLine(container).getByText('dashboard.line.charging')).toBeInTheDocument()
    expect(statusLine(container).getByText('dashboard.line.why.auto')).toBeInTheDocument()
  })

  it('puts a connected car that is not drawing power down to the car, not a pause', () => {
    status_store.set({ state: 2, vehicle: 1, total_day: 0, total_energy: 0 })
    const { container, queryByText } = render(Dashboard)
    expect(statusLine(container).getByText('dashboard.line.connected')).toBeInTheDocument()
    expect(statusLine(container).getByText('dashboard.line.why.connected')).toBeInTheDocument()
    expect(queryByText('dashboard.line.paused')).not.toBeInTheDocument()
  })

  it('gives a fault its name and a next step', () => {
    status_store.set({ state: 6, vehicle: 1, total_day: 0, total_energy: 0 })
    const { container } = render(Dashboard)
    expect(statusLine(container).getByText('dashboard.line.fault')).toBeInTheDocument()
    expect(statusLine(container).getByText('logs-states.error-gfi')).toBeInTheDocument()
    expect(statusLine(container).getByText('dashboard.line.fault_next.gfi')).toBeInTheDocument()
  })

  // The visible line is remounted when the hero swaps, and a freshly mounted
  // live region is not announced, so one region outlives both heroes.
  it('announces the status through a live region that survives the hero swap', async () => {
    status_store.set({ state: 254, vehicle: 1, total_day: 0, total_energy: 0 })
    const { getByRole } = render(Dashboard)
    const region = getByRole('status')
    expect(region).toHaveTextContent('dashboard.line.paused')
    status_store.set({ state: 3, vehicle: 1, power: 7000, voltage: 240, amp: 32000, session_energy: 0, session_elapsed: 0, temp: 0, pilot: 32 })
    await Promise.resolve()
    expect(getByRole('status')).toBe(region)
    expect(region).toHaveTextContent('dashboard.line.charging')
  })

  it('shows the session chart hero while charging with dev features off (ungated)', () => {
    status_store.set({ state: 3, power: 7000, voltage: 240, amp: 32000, session_energy: 0, session_elapsed: 0, temp: 0, pilot: 0, total_day: 0, total_energy: 0 })
    const { getByText } = render(Dashboard)
    // ChargingHero → SessionChart renders the "collecting…" placeholder until
    // there are ≥2 raw samples; its presence proves the chart path is live
    // without needing Labs enabled.
    expect(getByText('dashboard.session.collecting')).toBeInTheDocument()
  })

  // Load shaper caps the current at 24 A under the requested 48 A: the status
  // line and the rate control both say who.
  it('names the client capping the current, in the status line and the rate control', async () => {
    status_store.set({ state: 3, vehicle: 1, power: 5000, voltage: 240, amp: 24000, session_energy: 0, session_elapsed: 0, temp: 0, pilot: 24 })
    claims_target_store.set({
      properties: { state: 'active', charge_current: 48, max_current: 24 },
      claims: { state: null, charge_current: EvseClients.manual.id, max_current: EvseClients.shaper.id },
    })
    const { container, getByRole, getAllByText } = render(Dashboard)
    expect(statusLine(container).getByText('dashboard.line.cap(name:shaper)')).toBeInTheDocument()
    await fireEvent.click(getByRole('button', { name: /^dashboard\.rate\.label/ }))
    expect(getAllByText('dashboard.line.cap(name:shaper)')).toHaveLength(2)
  })

  it('leaves the cap out of the status line while nothing could flow anyway', () => {
    status_store.set({ state: 254, vehicle: 1, total_day: 0, total_energy: 0 })
    claims_target_store.set({
      properties: { state: 'disabled', charge_current: 48, max_current: 24 },
      claims: { state: null, max_current: EvseClients.shaper.id },
    })
    const { container } = render(Dashboard)
    expect(statusLine(container).queryByText(/dashboard\.line\.cap/)).toBeNull()
  })

  it('names the client setting the rate in words, not its internal key', async () => {
    status_store.set({ state: 3, vehicle: 1, power: 3000, voltage: 240, amp: 12000, session_energy: 0, session_elapsed: 0, temp: 0, pilot: 12 })
    claims_target_store.set({
      properties: { state: 'active', charge_current: 12 },
      claims: { state: null, charge_current: EvseClients.tempThrottle.id },
    })
    const { getByRole, getByText } = render(Dashboard)
    await fireEvent.click(getByRole('button', { name: /^dashboard\.rate\.label/ }))
    expect(getByText('dashboard.rate.claimed(name:tempThrottle)')).toBeInTheDocument()
  })

  it('renders the idle composition when state is 1', () => {
    status_store.set({ state: 1, total_day: 3.2, total_energy: 7523 })
    const { container } = render(Dashboard)
    expect(statusLine(container).getByText('dashboard.line.ready')).toBeInTheDocument()
    expect(statusLine(container).getByText('dashboard.line.why.ready')).toBeInTheDocument()
  })

  it('says a car is plugged in while paused', () => {
    // The payoff case: a car plugged in but paused on a schedule reads state
    // 254 (Sleeping). The state code alone can't tell — the vehicle flag can.
    status_store.set({ state: 254, vehicle: 1, total_day: 0, total_energy: 0 })
    const { container } = render(Dashboard)
    expect(statusLine(container).getByText('dashboard.line.plug_in')).toBeInTheDocument()
  })

  it('says no car is plugged in while paused', () => {
    status_store.set({ state: 254, vehicle: 0, total_day: 0, total_energy: 0 })
    const { container } = render(Dashboard)
    expect(statusLine(container).getByText('dashboard.line.plug_out')).toBeInTheDocument()
  })

  it('caps the rate slider at the configured soft max, not the hardware max', async () => {
    // Settings > Charger sets max_current_soft; the home-page rate control must
    // honour it rather than letting the user reach the hardware ceiling. The
    // slider lives in the rate pill's popover, so open it first.
    config_store.set({ max_current_soft: 32, max_current_hard: 48, divert_enabled: false, current_shaper_enabled: false })
    status_store.set({ state: 1, total_day: 0, total_energy: 0 })
    const { getByRole } = render(Dashboard)
    await fireEvent.click(getByRole('button', { name: /^dashboard\.rate\.label/ }))
    expect(getByRole('slider', { name: /^dashboard\.rate\.label/ })).toHaveAttribute('max', '32')
  })

  it('falls back to the hardware max for the rate slider when no soft max is set', async () => {
    config_store.set({ max_current_hard: 40, divert_enabled: false, current_shaper_enabled: false })
    status_store.set({ state: 1, total_day: 0, total_energy: 0 })
    const { getByRole } = render(Dashboard)
    await fireEvent.click(getByRole('button', { name: /^dashboard\.rate\.label/ }))
    expect(getByRole('slider', { name: /^dashboard\.rate\.label/ })).toHaveAttribute('max', '40')
  })

  it('ignores a hardware max of 0 (not read from the controller yet) for the rate slider', async () => {
    // GET /config reports max_current_hard straight from the controller
    // cache, which is 0 until $GC has been answered — and min(soft, 0) would
    // pin the pill at 0 A with a slider that cannot move.
    config_store.set({ max_current_soft: 32, max_current_hard: 0, divert_enabled: false, current_shaper_enabled: false })
    status_store.set({ state: 1, total_day: 0, total_energy: 0 })
    const { getByRole } = render(Dashboard)
    await fireEvent.click(getByRole('button', { name: /^dashboard\.rate\.label/ }))
    expect(getByRole('slider', { name: /^dashboard\.rate\.label/ })).toHaveAttribute('max', '32')
  })

  it('falls back to 48 A when neither max is usable', async () => {
    config_store.set({ max_current_hard: 0, divert_enabled: false, current_shaper_enabled: false })
    status_store.set({ state: 1, total_day: 0, total_energy: 0 })
    const { getByRole } = render(Dashboard)
    await fireEvent.click(getByRole('button', { name: /^dashboard\.rate\.label/ }))
    expect(getByRole('slider', { name: /^dashboard\.rate\.label/ })).toHaveAttribute('max', '48')
  })

  it('locks the mode pill to the claim owner (RFID)', () => {
    status_store.set({ state: 1, total_day: 0, total_energy: 0 })
    claims_target_store.set({ properties: {}, claims: { state: EvseClients.rfid.id } })
    const { getByText, queryByRole } = render(Dashboard)
    // ChargeControls renders a locked-state box with the owner label embedded
    expect(getByText('dashboard.controls.locked_by')).toBeInTheDocument()
    // locked state hides the mode radiogroup entirely
    expect(queryByRole('radiogroup', { name: 'dashboard.mode.aria' })).not.toBeInTheDocument()
  })

  it('treats a reached charge limit as a status reason, not a control lock', () => {
    // Limit tripped: device sleeping (254) with the limit holding the claim.
    status_store.set({ state: 254, total_day: 0, total_energy: 0 })
    claims_target_store.set({ properties: {}, claims: { state: EvseClients.limit.id } })
    limit_store.set({ type: 'soc', value: 80, auto_release: true })
    const { container, getByRole, queryByText } = render(Dashboard)
    // The reason shows in the status line, and the controls stay live (not locked).
    expect(statusLine(container).getByText('dashboard.line.why.limit_reached')).toBeInTheDocument()
    expect(queryByText('dashboard.controls.locked_by')).not.toBeInTheDocument()
    expect(getByRole('radiogroup', { name: 'dashboard.mode.aria' })).toBeInTheDocument()
  })

  it('clears the tripped limit when On is selected so charging resumes', async () => {
    status_store.set({ state: 254, total_day: 0, total_energy: 0 })
    claims_target_store.set({ properties: {}, claims: { state: EvseClients.limit.id } })
    limit_store.set({ type: 'soc', value: 80, auto_release: true })
    const { getByText } = render(Dashboard)
    // On forces charge; since the limit claim outranks manual, setSegment also
    // removes the limit (DELETE /limit) on top of the active override.
    await fireEvent.click(getByText('dashboard.mode.on'))
    await vi.waitFor(() => {
      expect(httpAPI).toHaveBeenCalledWith('DELETE', '/limit')
    })
  })

  it('shows Off picked while the Manual override holds the charger disabled', () => {
    status_store.set({ state: 254, vehicle: 1, total_day: 0, total_energy: 0 })
    claims_target_store.set({
      properties: { state: 'disabled' },
      claims: { state: EvseClients.manual.id },
    })
    const { getByRole } = render(Dashboard)
    expect(getByRole('radio', { name: 'dashboard.mode.off' })).toHaveAttribute('aria-checked', 'true')
  })

  it('surfaces the global alert, and puts the rate back, when returning to the default rate fails', async () => {
    status_store.set({ state: 1, total_day: 0, total_energy: 0 })
    override_store.set({ charge_current: 20, auto_release: false })
    claims_target_store.set({
      properties: { state: 'active', charge_current: 20 },
      claims: { state: null, charge_current: EvseClients.manual.id },
    })
    httpAPI.mockResolvedValue('error')
    const { getByRole } = render(Dashboard)
    await fireEvent.click(getByRole('button', { name: /^dashboard\.rate\.label/ }))
    const slider = getByRole('slider', { name: /^dashboard\.rate\.label/ })
    slider.value = '48' // the default rate (max_current_soft)
    await fireEvent.change(slider)
    await vi.waitFor(() => {
      expect(httpAPI).toHaveBeenCalledWith('DELETE', '/override')
      expect(get(uistates_store).alertbox.visible).toBe(true)
    })
  })

  it('surfaces the global alert when a mode write fails', async () => {
    status_store.set({ state: 1, total_day: 0, total_energy: 0 })
    httpAPI.mockResolvedValue('error')
    const { getByText } = render(Dashboard)
    // Click the 'On' segment button directly — setSegment calls override_store.upload
    // which goes through httpAPI; the mock returns 'error' so showWriteError fires.
    await fireEvent.click(getByText('dashboard.mode.on'))
    await vi.waitFor(() => {
      expect(get(uistates_store).alertbox.visible).toBe(true)
    })
  })

  it('drives /divertmode when the Eco segment is selected', async () => {
    status_store.set({ state: 1, total_day: 0, total_energy: 0 })
    config_store.set({ max_current_soft: 48, divert_enabled: true, current_shaper_enabled: false })
    const { getByText } = render(Dashboard)
    // Click the Eco segment button in ChargeControls — setSegment('eco') releases the
    // override then POSTs divertmode=2.
    await fireEvent.click(getByText('dashboard.eco'))
    await vi.waitFor(() => {
      expect(httpAPI).toHaveBeenCalledWith('POST', '/divertmode', 'divertmode=2', 'text')
    })
  })

  it('uploads a disabled override when the Off segment is selected', async () => {
    status_store.set({ state: 1, total_day: 0, total_energy: 0 })
    const { getByText } = render(Dashboard)
    // setSegment('off') uploads an override with state 'disabled' and the
    // soft-max fallback current (no prior override charge_current set).
    await fireEvent.click(getByText('dashboard.mode.off'))
    await vi.waitFor(() => {
      expect(httpAPI).toHaveBeenCalledWith(
        'POST',
        '/override',
        JSON.stringify({ state: 'disabled', charge_current: 48, auto_release: false }),
      )
    })
  })

  it('keeps the mode control enabled and focused while its write is in flight', async () => {
    // Disabling a focused control throws keyboard focus to the page body.
    status_store.set({ state: 1, total_day: 0, total_energy: 0 })
    let release
    // Held open until the end; serialQueue is shared, so it must settle.
    httpAPI.mockReturnValue(new Promise((r) => { release = r }))
    const { getByRole } = render(Dashboard)
    const off = getByRole('radio', { name: 'dashboard.mode.off' })
    off.focus()
    await fireEvent.click(off)
    await vi.waitFor(() => expect(httpAPI).toHaveBeenCalledWith('POST', '/override', expect.any(String)))
    try {
      for (const radio of [off, getByRole('radio', { name: 'dashboard.mode.on' })]) {
        expect(radio).not.toBeDisabled()
      }
      expect(document.activeElement).toBe(off)
    } finally {
      release({ msg: 'done' })
    }
  })

  it('writes the last limit the slider reached during a write, skipping the steps between', async () => {
    status_store.set({ state: 3, power: 7000, voltage: 240, amp: 0, temp: 0, pilot: 0, total_day: 0, total_energy: 0, battery_level: 74, vehicle_charge_limit: 90, battery_range: 206, time_to_full_charge: 0 })
    let release
    const firstWrite = new Promise((r) => { release = r })
    httpAPI.mockImplementation((method, url) =>
      method === 'POST' && url === '/limit' && !release.used
        ? ((release.used = true), firstWrite)
        : Promise.resolve({ msg: 'done' }),
    )
    const { getByRole } = render(Dashboard)
    const slider = getByRole('slider', { name: 'dashboard.vehicle.target_aria' })
    try {
      for (const v of ['85', '84', '83']) {
        slider.value = v
        await fireEvent.change(slider)
      }
      expect(slider).not.toBeDisabled()
    } finally {
      release({ msg: 'done' }) // serialQueue is shared, so it must settle
    }
    await vi.waitFor(() => {
      const posts = httpAPI.mock.calls.filter(([m, u]) => m === 'POST' && u === '/limit').map(([, , body]) => JSON.parse(body).value)
      expect(posts).toEqual([85, 83])
    })
  })

  it('shows the charge-limit bar when battery_level is present', () => {
    status_store.set({ state: 3, power: 7000, voltage: 240, amp: 0, temp: 0, pilot: 0, total_day: 0, total_energy: 0, battery_level: 74, vehicle_charge_limit: 80, battery_range: 206, time_to_full_charge: 0 })
    const { getByRole } = render(Dashboard)
    expect(getByRole('slider', { name: 'dashboard.vehicle.target_aria' })).toBeInTheDocument()
  })

  it('hides the SOC bar when there is no battery_level', () => {
    status_store.set({ state: 1, total_day: 0, total_energy: 0 })
    const { queryByRole } = render(Dashboard)
    expect(queryByRole('slider', { name: 'dashboard.vehicle.target_aria' })).not.toBeInTheDocument()
  })

  it('shows the SOC bar whenever battery_level is present', () => {
    status_store.set({ state: 3, power: 7000, voltage: 240, amp: 0, temp: 0, pilot: 0, total_day: 0, total_energy: 0, battery_level: 74, vehicle_charge_limit: 80, battery_range: 206, time_to_full_charge: 0 })
    const { getByRole } = render(Dashboard)
    expect(getByRole('slider', { name: 'dashboard.vehicle.target_aria' })).toBeInTheDocument()
  })

  it('uploads a soc limit when the bar is committed in percent mode', async () => {
    status_store.set({ state: 3, power: 7000, voltage: 240, amp: 0, temp: 0, pilot: 0, total_day: 0, total_energy: 0, battery_level: 74, vehicle_charge_limit: 90, battery_range: 206, time_to_full_charge: 0 })
    const { getByRole } = render(Dashboard)
    const slider = getByRole('slider', { name: 'dashboard.vehicle.target_aria' })
    slider.value = '85'
    await fireEvent.change(slider)
    await vi.waitFor(() => {
      expect(httpAPI).toHaveBeenCalledWith('POST', '/limit', JSON.stringify({ type: 'soc', value: 85, auto_release: true }))
    })
  })

  it('uploads a range limit when committed in range mode', async () => {
    // Range mode now follows the active limit / Range pill; the toggle is gone.
    // Seed an active range limit so limitUnit resolves to 'range' without any toggle click.
    status_store.set({ state: 3, power: 7000, voltage: 240, amp: 0, temp: 0, pilot: 0, total_day: 0, total_energy: 0, battery_level: 74, vehicle_charge_limit: 90, battery_range: 206, time_to_full_charge: 0 })
    limit_store.set({ type: 'range', value: 100, auto_release: true })
    const { getByRole } = render(Dashboard)
    const slider = getByRole('slider', { name: 'dashboard.vehicle.target_aria' })
    slider.value = '50' // 50% of estMaxRange(206/0.74≈278.4) ≈ 139 km
    await fireEvent.change(slider)
    await vi.waitFor(() => {
      expect(httpAPI).toHaveBeenCalledWith('POST', '/limit', JSON.stringify({ type: 'range', value: 139, auto_release: true }))
    })
  })

  it('clears the soc limit when the knob is dragged up to the vehicle limit', async () => {
    limit_store.set({ type: 'soc', value: 60, auto_release: true })
    status_store.set({ state: 3, power: 7000, voltage: 240, amp: 0, temp: 0, pilot: 0, total_day: 0, total_energy: 0, battery_level: 74, vehicle_charge_limit: 80, battery_range: 206, time_to_full_charge: 0 })
    const { getByRole } = render(Dashboard)
    const slider = getByRole('slider', { name: 'dashboard.vehicle.target_aria' })
    slider.value = '80' // at the vehicle limit → no limit
    await fireEvent.change(slider)
    await vi.waitFor(() => {
      expect(httpAPI).toHaveBeenCalledWith('DELETE', '/limit')
    })
  })

  it('renders the ChargeControls segment group and the rate pill', () => {
    status_store.set({ state: 3, power: 7000, voltage: 240, amp: 32000, session_energy: 0, session_elapsed: 0, temp: 0, pilot: 0, total_day: 0, total_energy: 0 })
    const { getByRole } = render(Dashboard)
    // ChargeControls renders a radiogroup for the mode segment control
    expect(getByRole('radiogroup', { name: 'dashboard.mode.aria' })).toBeInTheDocument()
    // RatePill is still present in the non-chart path
    expect(getByRole('button', { name: /^dashboard\.rate\.label/ })).toBeInTheDocument()
  })

  it('writes the charge rate from the rate pill', async () => {
    status_store.set({ state: 3, power: 7000, voltage: 240, amp: 32000, session_energy: 0, session_elapsed: 0, temp: 0, pilot: 0, total_day: 0, total_energy: 0 })
    const { getByRole } = render(Dashboard)
    await fireEvent.click(getByRole('button', { name: /^dashboard\.rate\.label/ }))
    const slider = getByRole('slider', { name: /^dashboard\.rate\.label/ })
    slider.value = '20'
    await fireEvent.change(slider)
    await vi.waitFor(() => {
      expect(httpAPI).toHaveBeenCalledWith('POST', '/override', expect.stringContaining('"charge_current":20'))
    })
  })

  // On a phone the section is one flex column ordered by max-lg:order-*.
  // What the charger is doing comes first, then the controls that change it,
  // and only then the readouts — not the mode control 800 px down.
  it('puts the status, then the controls, then the readouts on a phone', () => {
    status_store.set({ state: 3, vehicle: 1, power: 7000, voltage: 240, amp: 32000, session_energy: 0, session_elapsed: 0, temp: 0, pilot: 32, battery_level: 60 })
    const { container, getByRole, getByText } = render(Dashboard)
    const order = (el) => Number(/max-lg:order-(\d+)/.exec(el.closest('[class*="max-lg:order-"]').className)[1])
    const status = order(container.querySelector('[data-status-line]'))
    const mode = order(getByRole('radiogroup', { name: 'dashboard.mode.aria' }))
    const limit = order(getByRole('radiogroup', { name: 'dashboard.limit.pills_aria' }))
    const tiles = order(getByText('dashboard.chips.charging_current'))
    expect(status).toBeLessThan(mode)
    expect(mode).toBeLessThan(limit)
    expect(limit).toBeLessThan(tiles)
  })

  it('carries the desktop two-column grid classes', () => {
    status_store.set({ state: 1, total_day: 0, total_energy: 0 })
    const { container } = render(Dashboard)
    const section = container.querySelector('section')
    expect(section.className).toContain('lg:grid-cols-2')
    // two column wrappers that dissolve on mobile
    expect(container.querySelectorAll('section > [class*="max-lg:contents"]')).toHaveLength(2)
  })

  it('renders the active system limit editor disabled', () => {
    status_store.set({ state: 1, total_day: 0, total_energy: 0 })
    limit_store.set({ type: 'energy', value: 10000, auto_release: false })
    const { getByRole } = render(Dashboard)
    expect(getByRole('slider', { name: 'dashboard.limit.type_energy' })).toBeDisabled()
  })

  it('renders a user limit editor enabled', () => {
    status_store.set({ state: 1, total_day: 0, total_energy: 0 })
    limit_store.set({ type: 'energy', value: 10000, auto_release: true })
    const { getByRole } = render(Dashboard)
    expect(getByRole('slider', { name: 'dashboard.limit.type_energy' })).not.toBeDisabled()
  })

  it('uploads a time limit committed from the inline editor', async () => {
    status_store.set({ state: 1, total_day: 0, total_energy: 0 })
    const { getByRole } = render(Dashboard)
    const slider = getByRole('slider', { name: 'dashboard.limit.type_time' })
    slider.value = '8' // tick 8 on the 15-min segment = 120 min
    await fireEvent.change(slider)
    await vi.waitFor(() => {
      expect(httpAPI).toHaveBeenCalledWith('POST', '/limit', JSON.stringify({ type: 'time', value: 120, auto_release: true }))
    })
  })

  it('drag-to-zero clears a user limit', async () => {
    // user limit: DELETE goes through
    status_store.set({ state: 1, total_day: 0, total_energy: 0 })
    limit_store.set({ type: 'time', value: 120, auto_release: true })
    const first = render(Dashboard)
    const slider = first.getByRole('slider', { name: 'dashboard.limit.type_time' })
    slider.value = '0'
    await fireEvent.change(slider)
    await vi.waitFor(() => {
      expect(httpAPI).toHaveBeenCalledWith('DELETE', '/limit')
    })
  })

  it('does not DELETE a system limit when the bar commits at the ceiling', async () => {
    status_store.set({ state: 3, power: 7000, voltage: 240, amp: 0, temp: 0, pilot: 0, total_day: 0, total_energy: 0, battery_level: 74, vehicle_charge_limit: 80, battery_range: 206, time_to_full_charge: 0 })
    limit_store.set({ type: 'soc', value: 70, auto_release: false })
    const { getByRole } = render(Dashboard)
    const slider = getByRole('slider', { name: 'dashboard.vehicle.target_aria' })
    slider.value = '80' // at the vehicle ceiling → would clear a user limit
    await fireEvent.change(slider)
    await new Promise((r) => setTimeout(r, 0))
    expect(httpAPI).not.toHaveBeenCalledWith('DELETE', '/limit')
    expect(httpAPI).not.toHaveBeenCalledWith('POST', '/limit', expect.anything())
  })

  it('does not DELETE a system limit when forcing On past a trip', async () => {
    status_store.set({ state: 254, total_day: 0, total_energy: 0 })
    claims_target_store.set({ properties: {}, claims: { state: EvseClients.limit.id } })
    limit_store.set({ type: 'energy', value: 10000, auto_release: false })
    const { getByText } = render(Dashboard)
    await fireEvent.click(getByText('dashboard.mode.on'))
    await vi.waitFor(() => {
      expect(httpAPI).toHaveBeenCalled() // the override write happened
    })
    // Flush the queued microtasks so a (buggy) follow-up DELETE would have landed.
    await new Promise((r) => setTimeout(r, 0))
    expect(httpAPI).not.toHaveBeenCalledWith('DELETE', '/limit')
  })

  it('hides the Boost surface on firmware that does not advertise it', () => {
    // No boost_version in /status ⇒ unsupported ⇒ nothing rendered.
    status_store.set({ state: 1, total_day: 0, total_energy: 0 })
    const { queryByText } = render(Dashboard)
    expect(queryByText('dashboard.boost.label')).not.toBeInTheDocument()
  })

  it('arms a boost via POST /boost and never touches /override or /limit', async () => {
    // boost_version present ⇒ the collapsed Boost button renders.
    status_store.set({ state: 1, total_day: 0, total_energy: 0, boost_version: 1 })
    // A system (default) limit — the old boost path used to defensively clear
    // limits and rewrite the override; the device-side boost must not.
    limit_store.set({ type: 'energy', value: 10000, auto_release: false })
    httpAPI.mockResolvedValue({ msg: 'done' })
    const { getByText } = render(Dashboard)
    // Tap "Boost" to expand the picker, then arm. Default dimension is time
    // (30 min) → POST {type:'time', value:1800}.
    await fireEvent.click(getByText('dashboard.boost.label'))
    await fireEvent.click(getByText('dashboard.boost.arm'))
    await vi.waitFor(() => {
      expect(httpAPI).toHaveBeenCalledWith('POST', '/boost', JSON.stringify({ type: 'time', value: 1800 }))
    })
    // Flush so any (buggy) follow-up limit/override write would have landed.
    await new Promise((r) => setTimeout(r, 0))
    expect(httpAPI).not.toHaveBeenCalledWith('DELETE', '/limit')
    expect(httpAPI).not.toHaveBeenCalledWith('POST', '/override', expect.anything())
  })

  it('never DELETEs a system limit from the inline editor, even if events reach it', async () => {
    // Defense-in-depth: the active system editor is disabled and the idle
    // editors suppress no-change commits, but the setInlineLimit guard must
    // hold even if a change event reaches the slider (jsdom dispatches to
    // disabled inputs; live races can too).
    status_store.set({ state: 1, total_day: 0, total_energy: 0 })
    limit_store.set({ type: 'time', value: 120, auto_release: false })
    const { getByRole } = render(Dashboard)
    const slider = getByRole('slider', { name: 'dashboard.limit.type_time' })
    expect(slider).toBeDisabled()
    slider.value = '0'
    await fireEvent.change(slider)
    await new Promise((r) => setTimeout(r, 0)) // flush would-be DELETE microtasks
    expect(httpAPI).not.toHaveBeenCalledWith('DELETE', '/limit')
  })

  it('hides the load sharing block when Labs (dev features) is off', () => {
    config_store.update((c) => ({ ...c, labs_enabled: false }))
    config_store.set({
      max_current_soft: 48,
      divert_enabled: false,
      current_shaper_enabled: false,
      loadsharing_enabled: true,
      loadsharing_role: false,
      loadsharing_group_max_current: 40,
    })
    claims_target_store.set({
      properties: { max_current: 16 },
      claims: { state: null, max_current: EvseClients.loadsharing.id },
    })
    status_store.set({ state: 1, total_day: 0, total_energy: 0, pilot: 16 })
    const { queryByText } = render(Dashboard)
    expect(queryByText('dashboard.loadsharing.title')).not.toBeInTheDocument()
    expect(queryByText('dashboard.loadsharing.line_controller')).not.toBeInTheDocument()
  })

  it('collapses to one line when nothing is limited', async () => {
    config_store.set({ labs_enabled: true,
      max_current_soft: 32, divert_enabled: false, current_shaper_enabled: false,
      loadsharing_enabled: true, loadsharing_role: false, loadsharing_group_max_current: 48,
    })
    claims_target_store.set({ properties: {}, claims: { state: null } })
    status_store.set({
      state: 1, total_day: 0, total_energy: 0, pilot: 32, loadsharing_status_version: 1,
      loadsharing_joined_peers: [{ hostname: 'me' }, { hostname: 'garage' }, { hostname: 'yard' }],
    })
    const { getByText, queryByText } = render(Dashboard)
    await vi.waitFor(() => expect(getByText('dashboard.loadsharing.line_controller')).toBeInTheDocument())
    expect(queryByText('dashboard.loadsharing.title')).not.toBeInTheDocument()
    expect(queryByText('dashboard.loadsharing.tile_limited')).not.toBeInTheDocument()
    // The verdict lives on /loadsharing/status; the version tick fetches it.
    expect(httpAPI).toHaveBeenCalledWith('GET', '/loadsharing/status')
  })

  it('shows the limited card, one amber reason, and tags the current tile', async () => {
    config_store.set({ labs_enabled: true,
      max_current_soft: 32, divert_enabled: false, current_shaper_enabled: false,
      loadsharing_enabled: true, loadsharing_role: true, loadsharing_controller_host: 'controller.local',
    })
    httpAPI.mockImplementation((m, url) =>
      Promise.resolve(url === '/loadsharing/status' ? { failsafe_active: false, online_count: 2, peers: [] } : {}),
    )
    claims_target_store.set({
      properties: { max_current: 16 },
      claims: { state: null, max_current: EvseClients.loadsharing.id },
    })
    status_store.set({
      state: 3, power: 3800, voltage: 240, amp: 16000, session_energy: 0, session_elapsed: 0, temp: 0,
      pilot: 16, loadsharing_status_version: 1,
    })
    const { getByText, queryByText } = render(Dashboard)
    await vi.waitFor(() => {
      expect(getByText('dashboard.loadsharing.pill_member_limited')).toBeInTheDocument()
      expect(getByText('dashboard.loadsharing.limited')).toBeInTheDocument()
    })
    expect(getByText('dashboard.loadsharing.tile_limited')).toBeInTheDocument()
    expect(queryByText('dashboard.loadsharing.pill_failsafe')).not.toBeInTheDocument()
    expect(queryByText('dashboard.loadsharing.line_member')).not.toBeInTheDocument()
  })

  it('calls a lost controller a failsafe, not sharing, with the host as a link', async () => {
    config_store.set({ labs_enabled: true,
      max_current_soft: 32, divert_enabled: false, current_shaper_enabled: false,
      loadsharing_enabled: true, loadsharing_role: true,
      loadsharing_controller_host: 'openevse-bench32.local', loadsharing_failsafe_safe_current: 6,
    })
    // The 6 A claim is identical to an allocation; only the firmware's
    // failsafe_active on /loadsharing/status tells them apart.
    httpAPI.mockImplementation((m, url) =>
      Promise.resolve(
        url === '/loadsharing/status'
          ? { failsafe_active: true, online_count: 0, peers: [{ host: 'openevse-bench32.local', online: false, last_seen: 80 }] }
          : {},
      ),
    )
    claims_target_store.set({
      properties: { max_current: 6 },
      claims: { state: null, max_current: EvseClients.loadsharing.id },
    })
    status_store.set({ state: 1, total_day: 0, total_energy: 0, pilot: 6, uptime: 8000, loadsharing_status_version: 3 })
    const { getByText, queryByText } = render(Dashboard)
    await vi.waitFor(() => expect(getByText('dashboard.loadsharing.pill_failsafe')).toBeInTheDocument())
    expect(getByText('dashboard.loadsharing.failsafe_for')).toBeInTheDocument()
    expect(getByText('openevse-bench32.local').closest('a')).toHaveAttribute('href', 'http://openevse-bench32.local')
    expect(getByText('dashboard.loadsharing.settings').closest('a')).toHaveAttribute('href', '#/settings/loadsharing')
    expect(queryByText('dashboard.loadsharing.pill_member_limited')).not.toBeInTheDocument()
    expect(queryByText('dashboard.loadsharing.limited')).not.toBeInTheDocument()
  })
})
