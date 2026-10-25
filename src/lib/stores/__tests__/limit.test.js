import { describe, it, expect, vi, beforeEach } from 'vitest'
import { get } from 'svelte/store'

vi.mock('../../api/httpAPI', async (importOriginal) => ({
  ...(await importOriginal()),
  httpAPI: vi.fn()
}))

import { limit_store } from '../limit'
import { httpAPI } from '../../api/httpAPI'

describe('limit_store', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    limit_store.set({ type: 'none', value: 0, auto_release: true })
  })

  it('should have all required methods', () => {
    expect(typeof limit_store.subscribe).toBe('function')
    expect(typeof limit_store.download).toBe('function')
    expect(typeof limit_store.upload).toBe('function')
    expect(typeof limit_store.remove).toBe('function')
    expect(typeof limit_store.reset).toBe('function')
  })

  it('should initialize with default model', () => {
    const state = get(limit_store)
    expect(state.type).toBe('none')
    expect(state.value).toBe(0)
    expect(state.auto_release).toBe(true)
  })

  it('should download limit data', async () => {
    const mockLimit = { type: 'time', value: 3600 }
    httpAPI.mockResolvedValue(mockLimit)

    const result = await limit_store.download()
    expect(result).toBe(true)
    expect(httpAPI).toHaveBeenCalledWith('GET', '/limit')

    const state = get(limit_store)
    expect(state.type).toBe('time')
    expect(state.value).toBe(3600)
  })

  it('should reset limit when no limit message received', async () => {
    httpAPI.mockResolvedValue({ msg: 'no limit' })
    const result = await limit_store.download()
    expect(result).toBe(true)

    const state = get(limit_store)
    expect(state.type).toBe('none')
    expect(state.value).toBe(0)
  })

  // Firmware since v5 answers GET /limit with 200 {} when no limit is set.
  it('reads an empty reply as no limit', async () => {
    limit_store.set({ type: 'time', value: 3600, auto_release: true })
    httpAPI.mockResolvedValue({})
    expect(await limit_store.download()).toBe(true)
    expect(get(limit_store)).toEqual({ type: 'none', value: 0, auto_release: true })
  })

  it('should return false on download error', async () => {
    httpAPI.mockResolvedValue('error')
    const result = await limit_store.download()
    expect(result).toBe(false)
  })

  it('uploads a limit, and holds it once the charger accepts it', async () => {
    httpAPI.mockResolvedValue({ msg: 'done' })
    const data = { type: 'energy', value: 10000, auto_release: true }
    const result = await limit_store.upload(data)
    expect(result).toBe(true)
    expect(httpAPI).toHaveBeenCalledWith('POST', '/limit', JSON.stringify(data))
    expect(get(limit_store)).toEqual(data)
  })

  it('keeps the limit it held when the charger refuses an upload', async () => {
    limit_store.set({ type: 'soc', value: 80, auto_release: true })
    httpAPI.mockResolvedValue('error')
    const result = await limit_store.upload({ type: 'time', value: 60, auto_release: true })
    expect(result).toBe(false)
    expect(get(limit_store)).toEqual({ type: 'soc', value: 80, auto_release: true })
  })

  it('should remove limit', async () => {
    httpAPI.mockResolvedValue({ msg: 'done' })
    const result = await limit_store.remove()
    expect(result).toBe(true)
    expect(httpAPI).toHaveBeenCalledWith('DELETE', '/limit')

    const state = get(limit_store)
    expect(state.type).toBe('none')
  })

  it('should return false on remove failure', async () => {
    httpAPI.mockResolvedValue({ msg: 'error' })
    const result = await limit_store.remove()
    expect(result).toBe(false)
  })

  it('should reset to default model', () => {
    limit_store.set({ type: 'time', value: 5000, auto_release: false })
    const result = limit_store.reset()
    expect(result).toBe(true)

    const state = get(limit_store)
    expect(state.type).toBe('none')
    expect(state.value).toBe(0)
    expect(state.auto_release).toBe(true)
  })
})
