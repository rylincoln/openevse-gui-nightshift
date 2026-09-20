// src/routes/settings/__tests__/Mqtt.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'
import { get } from 'svelte/store'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})
vi.mock('../../../lib/api/httpAPI', () => ({ httpAPI: vi.fn(() => Promise.resolve({ msg: 'done' })) }))

import { httpAPI } from '../../../lib/api/httpAPI'
import { config_store } from '../../../lib/stores/config'
import { status_store } from '../../../lib/stores/status'
import { certificate_store } from '../../../lib/stores/certificates'
import { uistates_store } from '../../../lib/stores/uistates'
import Mqtt from '../Mqtt.svelte'

beforeEach(() => {
  uistates_store.resetAlertBox()
  httpAPI.mockReset()
  httpAPI.mockResolvedValue({ msg: 'done' })
  status_store.set({ mqtt_connected: false })
  certificate_store.set([])
})

describe('MQTT page', () => {
  it('hides the form until mqtt is enabled', () => {
    config_store.set({ mqtt_enabled: false, mqtt_supported_protocols: ['mqtt'] })
    const { queryByText } = render(Mqtt)
    expect(queryByText('config.mqtt.server')).not.toBeInTheDocument()
  })

  it('shows the form when mqtt is enabled', () => {
    config_store.set({ mqtt_enabled: true, mqtt_protocol: 'mqtt', mqtt_supported_protocols: ['mqtt', 'mqtts'] })
    const { getByText } = render(Mqtt)
    expect(getByText('config.mqtt.server')).toBeInTheDocument()
  })

  it('shows the TLS block only for the mqtts protocol', async () => {
    config_store.set({ mqtt_enabled: true, mqtt_protocol: 'mqtt', mqtt_supported_protocols: ['mqtt', 'mqtts'] })
    const { queryByText, rerender } = render(Mqtt)
    expect(queryByText('config.mqtt.reject_unauthorized')).not.toBeInTheDocument()
    config_store.set({ mqtt_enabled: true, mqtt_protocol: 'mqtts', mqtt_supported_protocols: ['mqtt', 'mqtts'] })
    await vi.waitFor(() => {
      expect(queryByText('config.mqtt.reject_unauthorized')).toBeInTheDocument()
    })
  })

  it('saves the server field on blur', async () => {
    config_store.set({ mqtt_enabled: true, mqtt_protocol: 'mqtt', mqtt_server: 'old', mqtt_supported_protocols: ['mqtt'] })
    const { getByDisplayValue } = render(Mqtt)
    const input = getByDisplayValue('old')
    await fireEvent.input(input, { target: { value: 'broker.local' } })
    await fireEvent.blur(input)
    expect(httpAPI).toHaveBeenCalledWith('POST', '/config', JSON.stringify({ mqtt_server: 'broker.local' }))
  })

  // NumberInput emits null when the port field is cleared to empty; it's
  // shown blank (no numeric fallback), so clearing it must not write
  // anything at all — not a literal null.
  it('does not save a null mqtt_port when the field is cleared', async () => {
    config_store.set({ mqtt_enabled: true, mqtt_protocol: 'mqtt', mqtt_port: 1883, mqtt_supported_protocols: ['mqtt'] })
    const { getByRole } = render(Mqtt)
    httpAPI.mockClear()
    const port = getByRole('spinbutton')
    await fireEvent.input(port, { target: { value: '' } })
    await fireEvent.blur(port)
    expect(httpAPI).not.toHaveBeenCalledWith('POST', '/config', expect.stringContaining('mqtt_port'))
  })

  it('surfaces the write-error alert on a failed save', async () => {
    httpAPI.mockResolvedValue('error')
    config_store.set({ mqtt_enabled: true, mqtt_protocol: 'mqtt', mqtt_server: 'old', mqtt_supported_protocols: ['mqtt'] })
    const { getByDisplayValue } = render(Mqtt)
    const input = getByDisplayValue('old')
    await fireEvent.input(input, { target: { value: 'broker.local' } })
    await fireEvent.blur(input)
    await vi.waitFor(() => {
      expect(get(uistates_store).alertbox.visible).toBe(true)
    })
  })
  it('saves the $SYS broker query toggle', async () => {
    config_store.set({ mqtt_enabled: true, mqtt_protocol: 'mqtt', mqtt_sys_query: true, mqtt_supported_protocols: ['mqtt'] })
    const { getByLabelText } = render(Mqtt)
    await fireEvent.click(getByLabelText('config.mqtt.sys_query'))
    expect(httpAPI).toHaveBeenCalledWith('POST', '/config', JSON.stringify({ mqtt_sys_query: false }))
  })
})
