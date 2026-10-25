// WiFi join: scan, pick or type a network, join it. Shared by Network
// settings and the setup wizard, which each say how the join is written.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})
vi.mock('../../../api/httpAPI', async (importOriginal) => ({ ...(await importOriginal()), httpAPI: vi.fn() }))

import { httpAPI } from '../../../api/httpAPI'
import WifiJoin from '../WifiJoin.svelte'

const SCAN = [
  { ssid: 'Weak', rssi: -80 },
  { ssid: 'Home', rssi: -45, encryption: 'wpa2' },
  { ssid: 'Cafe', rssi: -60, encryption: 'none' },
]

function scanReplies(reply = SCAN) {
  httpAPI.mockImplementation((m, url) => Promise.resolve(url === '/scan' ? reply : 'error'))
}

beforeEach(() => {
  httpAPI.mockReset()
  scanReplies()
})

describe('WifiJoin', () => {
  it('lists what a scan finds, strongest first', async () => {
    render(WifiJoin, { join: vi.fn() })
    await fireEvent.click(screen.getByText('config.network.scan'))
    await vi.waitFor(() => screen.getByText('Home'))
    const names = screen.getAllByRole('button').map((b) => b.textContent.trim())
    expect(names.indexOf('Home')).toBeLessThan(names.indexOf('Cafe'))
    expect(names.indexOf('Cafe')).toBeLessThan(names.indexOf('Weak'))
  })

  it('scans as soon as it shows when asked to', async () => {
    render(WifiJoin, { join: vi.fn(), autoScan: true })
    await vi.waitFor(() => screen.getByText('Home'))
  })

  it('says a scan found nothing, but not before one has run', async () => {
    scanReplies([])
    render(WifiJoin, { join: vi.fn() })
    expect(screen.queryByText('config.network.scan_empty')).not.toBeInTheDocument()
    await fireEvent.click(screen.getByText('config.network.scan'))
    await vi.waitFor(() => screen.getByText('config.network.scan_empty'))
  })

  it('says when the scan fails', async () => {
    scanReplies('error')
    render(WifiJoin, { join: vi.fn() })
    await fireEvent.click(screen.getByText('config.network.scan'))
    await vi.waitFor(() => screen.getByText('config.network.scan_error'))
  })

  it('joins a picked network with its password', async () => {
    const join = vi.fn(() => Promise.resolve(true))
    const onjoined = vi.fn()
    render(WifiJoin, { join, onjoined })
    await fireEvent.click(screen.getByText('config.network.scan'))
    await fireEvent.click(await screen.findByText('Home'))
    await fireEvent.input(screen.getByLabelText('config.network.wifi_password'), { target: { value: 'secret' } })
    await fireEvent.click(screen.getByText('config.network.connect'))
    await vi.waitFor(() => expect(onjoined).toHaveBeenCalledWith('Home'))
    expect(join).toHaveBeenCalledWith('Home', 'secret')
  })

  it('asks no password for an open network', async () => {
    render(WifiJoin, { join: vi.fn() })
    await fireEvent.click(screen.getByText('config.network.scan'))
    await fireEvent.click(await screen.findByText('Cafe'))
    expect(screen.queryByLabelText('config.network.wifi_password')).not.toBeInTheDocument()
  })

  it('joins a network typed in, without its stray spaces', async () => {
    const join = vi.fn(() => Promise.resolve(true))
    render(WifiJoin, { join })
    await fireEvent.click(screen.getByText('config.network.manual'))
    const connect = screen.getByText('config.network.connect').closest('button')
    expect(connect).toBeDisabled()
    await fireEvent.input(screen.getByLabelText('config.network.ssid'), { target: { value: '  Hidden  ' } })
    await fireEvent.input(screen.getByLabelText('config.network.wifi_password'), { target: { value: 'secret' } })
    await fireEvent.click(connect)
    await vi.waitFor(() => expect(join).toHaveBeenCalledWith('Hidden', 'secret'))
  })

  it('stays ready to try again when the join is refused', async () => {
    const join = vi.fn(() => Promise.resolve(false))
    const onjoined = vi.fn()
    render(WifiJoin, { join, onjoined })
    await fireEvent.click(screen.getByText('config.network.scan'))
    await fireEvent.click(await screen.findByText('Home'))
    await fireEvent.click(screen.getByText('config.network.connect'))
    await vi.waitFor(() => expect(join).toHaveBeenCalled())
    await vi.waitFor(() => expect(screen.getByText('config.network.connect').closest('button')).not.toBeDisabled())
    expect(onjoined).not.toHaveBeenCalled()
  })
})
