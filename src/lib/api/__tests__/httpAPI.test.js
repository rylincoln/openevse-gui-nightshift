import { describe, it, expect, vi, beforeEach } from 'vitest'

import { httpAPI } from '../httpAPI'

// A fetch that never answers until its signal aborts, like a charger that
// accepted the connection and then went quiet.
const hangingFetch = () =>
  vi.fn((_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
  }))

describe('httpAPI', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('GETs JSON and returns the parsed body', async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve({ json: () => Promise.resolve({ ok: 1 }) }),
    )
    const res = await httpAPI('GET', '/status')
    expect(res).toEqual({ ok: 1 })
  })

  it('returns the string "error" when fetch rejects', async () => {
    globalThis.fetch = vi.fn(() => Promise.reject(new Error('network')))
    const res = await httpAPI('GET', '/status')
    expect(res).toBe('error')
  })

  it('with raw: true, resolves to { status, body } instead of just the body', async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve({ status: 400, text: () => Promise.resolve('nope') }),
    )
    const res = await httpAPI('GET', '/rfid/add', null, 'txt', 60000, { raw: true })
    expect(res).toEqual({ status: 400, body: 'nope' })
  })

  // The first request was once exempt so a browser Basic-auth prompt could
  // wait on the user; the firmware answers the app with a plain 401 instead,
  // and an exempt request to a silent charger left the loader up forever.
  it('gives up on a request the charger never answers, the first one included', async () => {
    vi.useFakeTimers()
    try {
      globalThis.fetch = hangingFetch()
      const pending = httpAPI('GET', '/status', null, 'json', 5000)
      await vi.advanceTimersByTimeAsync(5000)
      await expect(pending).resolves.toBe('error')
    } finally {
      vi.useRealTimers()
    }
  })

  it('cancels its timer once the response is in', async () => {
    vi.useFakeTimers()
    try {
      globalThis.fetch = vi.fn(() => Promise.resolve({ json: () => Promise.resolve({ ok: 1 }) }))
      await httpAPI('GET', '/status', null, 'json', 5000)
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('with raw: true, still resolves to the plain "error" string on a network failure', async () => {
    globalThis.fetch = vi.fn(() => Promise.reject(new Error('network')))
    const res = await httpAPI('GET', '/status', null, 'json', 60000, { raw: true })
    expect(res).toBe('error')
  })
})
