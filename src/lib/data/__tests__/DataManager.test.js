// DataManager keeps the versioned stores fresh from status frames. These drive
// it with frames, as WebSocket.svelte does, and watch what it asks the charger.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/svelte'
import { get } from 'svelte/store'

vi.mock('../../api/httpAPI', async (importOriginal) => ({ ...(await importOriginal()), httpAPI: vi.fn() }))

import { httpAPI } from '../../api/httpAPI'
import DataManager from '../DataManager.svelte'
import { status_store } from '../../stores/status'
import { limit_store } from '../../stores/limit'

const REPLIES = {
  '/config': { wizard_passed: true },
  '/schedule': [],
  '/schedule/plan': {},
  '/claims/target': { properties: {}, claims: {} },
  '/claims': [],
  '/override': {},
  '/limit': { type: 'energy', value: 5000, auto_release: true },
  '/boost': {},
  '/status': {},
}

// The status FetchData booted from: every store it downloads is at version 1.
const BOOT = {
  state: 1,
  config_version: 1,
  schedule_version: 1,
  schedule_plan_version: 1,
  claims_version: 1,
  override_version: 1,
}

const gets = (url) => httpAPI.mock.calls.filter(([m, u]) => m === 'GET' && u === url)
const settle = () => new Promise((r) => setTimeout(r, 0))

beforeEach(() => {
  httpAPI.mockReset()
  httpAPI.mockImplementation((_m, url) => Promise.resolve(REPLIES[url] ?? 'error'))
  status_store.set({ ...BOOT })
})

afterEach(() => cleanup())

describe('DataManager', () => {
  it('does not download again what FetchData has just loaded', async () => {
    render(DataManager)
    await settle()
    for (const url of ['/config', '/schedule', '/schedule/plan', '/claims/target', '/claims', '/override']) {
      expect(gets(url)).toHaveLength(0)
    }
  })

  it.each([
    ['config_version', '/config'],
    ['schedule_version', '/schedule'],
    ['schedule_plan_version', '/schedule/plan'],
    ['claims_version', '/claims/target'],
    ['claims_version', '/claims'],
    ['override_version', '/override'],
  ])('re-downloads when %s moves (GET %s)', async (field, url) => {
    render(DataManager)
    await settle()
    status_store.update((s) => ({ ...s, [field]: 2 }))
    await vi.waitFor(() => expect(gets(url)).toHaveLength(1))
  })

  it('asks for nothing on a frame that moves no counter', async () => {
    render(DataManager)
    await settle()
    httpAPI.mockClear()
    status_store.update((s) => ({ ...s, amp: 16000 }))
    status_store.update((s) => ({ ...s, amp: 32000 }))
    await settle()
    expect(httpAPI.mock.calls.filter(([m]) => m === 'GET')).toEqual([])
  })

  it('downloads once more when the counter moves while a download is under way', async () => {
    let release
    httpAPI.mockImplementation((_m, url) =>
      url === '/config' && !release
        ? new Promise((r) => { release = () => r(REPLIES['/config']) })
        : Promise.resolve(REPLIES[url] ?? 'error'))
    render(DataManager)
    await settle()
    status_store.update((s) => ({ ...s, config_version: 2 }))
    await vi.waitFor(() => expect(gets('/config')).toHaveLength(1))
    status_store.update((s) => ({ ...s, config_version: 3 }))
    await settle()
    expect(gets('/config')).toHaveLength(1)
    release()
    await vi.waitFor(() => expect(gets('/config')).toHaveLength(2))
  })

  it('downloads the limit when its counter moves while a limit is set', async () => {
    status_store.set({ ...BOOT, limit: true, limit_version: 1 })
    render(DataManager)
    await vi.waitFor(() => expect(gets('/limit')).toHaveLength(1))
    status_store.update((s) => ({ ...s, limit_version: 2 }))
    await vi.waitFor(() => expect(gets('/limit')).toHaveLength(2))
  })

  it('clears the limit without asking when its counter moves and no limit is set', async () => {
    limit_store.set({ type: 'time', value: 60, auto_release: true })
    status_store.set({ ...BOOT, limit: false, limit_version: 4 })
    render(DataManager)
    await settle()
    expect(gets('/limit')).toHaveLength(0)
    expect(get(limit_store)).toEqual({ type: 'none', value: 0, auto_release: true })
  })

  it('downloads the boost on firmware that counts it, and never on firmware that does not', async () => {
    render(DataManager)
    await settle()
    expect(gets('/boost')).toHaveLength(0)
    status_store.update((s) => ({ ...s, boost_version: 0 }))
    await vi.waitFor(() => expect(gets('/boost')).toHaveLength(1))
  })
})
