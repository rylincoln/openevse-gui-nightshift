// src/lib/config/__tests__/configForm.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { get } from 'svelte/store'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

vi.mock('../../api/httpAPI', async (importOriginal) => ({ ...(await importOriginal()), httpAPI: vi.fn() }))

import { httpAPI } from '../../api/httpAPI'
import { config_store } from '../../stores/config'
import { uistates_store } from '../../stores/uistates'
import { createConfigForm } from '../configForm.svelte'

describe('createConfigForm', () => {
  beforeEach(() => {
    config_store.set({ hostname: 'old' })
    uistates_store.resetAlertBox()
    httpAPI.mockReset()
  })

  it('saveField posts the field and updates the store on success', async () => {
    httpAPI.mockResolvedValue({ msg: 'done' })
    const form = createConfigForm()
    const ok = await form.saveField('hostname', 'new')
    expect(ok).toBe(true)
    expect(httpAPI).toHaveBeenCalledWith('POST', '/config', JSON.stringify({ hostname: 'new' }))
    expect(get(config_store).hostname).toBe('new')
    expect(form.saveState.statusOf('hostname')).toBe('saved')
  })

  it('saveField marks error, does not change the store, and alerts on failure', async () => {
    httpAPI.mockResolvedValue('error')
    const form = createConfigForm()
    const ok = await form.saveField('hostname', 'new')
    expect(ok).toBe(false)
    expect(get(config_store).hostname).toBe('old')
    expect(form.saveState.statusOf('hostname')).toBe('error')
    expect(get(uistates_store).alertbox.visible).toBe(true)
  })

  it('revert counter increments only on failure', async () => {
    httpAPI.mockResolvedValue({ msg: 'done' })
    const form = createConfigForm()
    const before = form.revert
    await form.saveField('hostname', 'a')
    expect(form.revert).toBe(before)
    httpAPI.mockResolvedValue('error')
    await form.saveField('hostname', 'b')
    expect(form.revert).toBe(before + 1)
  })

  it('saveFields posts several fields at once', async () => {
    httpAPI.mockResolvedValue({ msg: 'done' })
    const form = createConfigForm()
    await form.saveFields({ www_username: '', www_password: '' })
    expect(httpAPI).toHaveBeenCalledWith(
      'POST', '/config', JSON.stringify({ www_username: '', www_password: '' }),
    )
    expect(get(config_store).www_username).toBe('')
  })

  // NumberInput hands over null when a field is cleared to empty. What that
  // means is decided here, once, rather than page by page.
  describe('a cleared field', () => {
    it('writes nothing when the field has no fallback, and is put back', async () => {
      config_store.set({ mqtt_port: 1883 })
      const form = createConfigForm()
      const before = form.revert
      expect(await form.saveField('mqtt_port', null)).toBe(false)
      expect(httpAPI).not.toHaveBeenCalled()
      expect(form.revert).toBe(before + 1)
      expect(form.saveState.statusOf('mqtt_port')).not.toBe('error')
      expect(get(uistates_store).alertbox.visible).toBe(false)
    })

    it.each([
      ['www_https_port', 443],
      ['loadsharing_rotation_interval', 1800],
      ['scheduler_start_window', 0],
      ['scale', 0],
      ['offset', 0],
    ])('writes the fallback %s shows when unset (%i)', async (name, fallback) => {
      httpAPI.mockResolvedValue({ msg: 'done' })
      const form = createConfigForm()
      await form.saveField(name, null)
      expect(httpAPI).toHaveBeenCalledWith('POST', '/config', JSON.stringify({ [name]: fallback }))
    })
  })
})

