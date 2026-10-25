import { describe, it, expect, vi, beforeEach } from 'vitest'
import { get } from 'svelte/store'

vi.mock('../../api/httpAPI', async (importOriginal) => ({
  ...(await importOriginal()),
  httpAPI: vi.fn()
}))

import { boost_store } from '../boost'
import { httpAPI } from '../../api/httpAPI'

describe('boost_store', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    boost_store.reset()
  })

  it('should have all required methods', () => {
    expect(typeof boost_store.subscribe).toBe('function')
    expect(typeof boost_store.download).toBe('function')
    expect(typeof boost_store.upload).toBe('function')
    expect(typeof boost_store.remove).toBe('function')
    expect(typeof boost_store.reset).toBe('function')
  })

  it('should initialize with the idle model', () => {
    const state = get(boost_store)
    expect(state.type).toBe('none')
    expect(state.value).toBe(0)
  })

  it('should download an active boost', async () => {
    const active = { type: 'time', value: 3600, remaining: 2847, started: '2026-08-23T14:02:11Z' }
    httpAPI.mockResolvedValue(active)

    const result = await boost_store.download()
    expect(result).toBe(true)
    expect(httpAPI).toHaveBeenCalledWith('GET', '/boost')

    const state = get(boost_store)
    expect(state.type).toBe('time')
    expect(state.remaining).toBe(2847)
  })

  it('should treat the empty object (200, idle) as no boost', async () => {
    boost_store.set({ type: 'energy', value: 100, remaining: 40 })
    httpAPI.mockResolvedValue({})
    const result = await boost_store.download()
    expect(result).toBe(true)

    const state = get(boost_store)
    expect(state.type).toBe('none')
    expect(state.value).toBe(0)
  })

  it('should return false on download error (e.g. 404 on old firmware)', async () => {
    httpAPI.mockResolvedValue('error')
    const result = await boost_store.download()
    expect(result).toBe(false)
  })

  // Arming answers 201 when accepted, and 400 or 422 with the charger's
  // reason when it refuses; the dashboard shows that reason.
  const RAW = ['json', 60000, { raw: true }]

  it('arms a boost, reporting the charger accepted it', async () => {
    httpAPI.mockResolvedValue({ status: 201, body: { msg: 'done' } })
    const data = { type: 'energy', value: 100 }
    expect(await boost_store.upload(data)).toEqual({ ok: true })
    expect(httpAPI).toHaveBeenCalledWith('POST', '/boost', JSON.stringify(data), ...RAW)
  })

  it.each([
    [422, 'no vehicle data source for this boost type'],
    [400, 'failed to parse JSON'],
  ])('passes on the reason the charger gives for refusing a boost (%i)', async (status, msg) => {
    httpAPI.mockResolvedValue({ status, body: { msg } })
    expect(await boost_store.upload({ type: 'soc', value: 80 })).toEqual({ ok: false, reason: msg })
  })

  it('reports no reason when the charger cannot be reached', async () => {
    httpAPI.mockResolvedValue('error')
    expect(await boost_store.upload({ type: 'time', value: 600 })).toEqual({ ok: false })
  })

  it('should cancel a boost', async () => {
    boost_store.set({ type: 'time', value: 3600, remaining: 100 })
    httpAPI.mockResolvedValue({ status: 200, body: { msg: 'done' } })
    const result = await boost_store.remove()
    expect(result).toBe(true)
    expect(httpAPI).toHaveBeenCalledWith('DELETE', '/boost', null, ...RAW)
    expect(get(boost_store).type).toBe('none')
  })

  it('treats a 404 (no boost running) as an idempotent cancel success', async () => {
    boost_store.set({ type: 'time', value: 3600, remaining: 100 })
    httpAPI.mockResolvedValue({ status: 404, body: { msg: 'no boost' } })
    const result = await boost_store.remove()
    expect(result).toBe(true)
    expect(get(boost_store).type).toBe('none')
  })

  it.each([['error'], [{ status: 500, body: {} }]])(
    'reports a failed cancel and keeps the boost (%j)',
    async (reply) => {
      boost_store.set({ type: 'time', value: 3600, remaining: 100 })
      httpAPI.mockResolvedValue(reply)
      expect(await boost_store.remove()).toBe(false)
      expect(get(boost_store).type).toBe('time')
    },
  )

  it('should reset to the idle model', () => {
    boost_store.set({ type: 'soc', value: 80, remaining: 5 })
    expect(boost_store.reset()).toBe(true)
    const state = get(boost_store)
    expect(state.type).toBe('none')
    expect(state.value).toBe(0)
  })
})
