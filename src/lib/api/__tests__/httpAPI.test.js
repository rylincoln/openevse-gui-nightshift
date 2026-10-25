import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { httpAPI, pauseRequests, resumeRequests } from '../httpAPI'

// A fetch that never answers until its signal aborts, like a charger that
// accepted the connection and then went quiet.
const hangingFetch = () =>
  vi.fn((_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
  }))

// A fetch Response as far as httpAPI reads one.
const reply = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(body),
  text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
})

// A fetch whose replies the test hands out one at a time, in call order.
function heldFetch() {
  const pending = []
  const fetch = vi.fn(() => new Promise((resolve) => pending.push(resolve)))
  return { fetch, answer: (body, status) => pending.shift()(reply(body, status)) }
}

// Let queued promise callbacks run.
const settle = () => new Promise((r) => setTimeout(r, 0))

describe('httpAPI', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('GETs JSON and returns the parsed body', async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(reply({ ok: 1 })))
    const res = await httpAPI('GET', '/status')
    expect(res).toEqual({ ok: 1 })
  })

  // The status code, not the reply's wording, says whether the charger
  // accepted a request: a refusal's {msg} must not pass for a payload.
  it('returns the string "error" for a reply outside 2xx, whatever its body', async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(reply({ msg: 'Failed to claim manual override' }, 500)))
    expect(await httpAPI('POST', '/override', '{}')).toBe('error')
  })

  it('returns the string "error" when fetch rejects', async () => {
    globalThis.fetch = vi.fn(() => Promise.reject(new Error('network')))
    const res = await httpAPI('GET', '/status')
    expect(res).toBe('error')
  })

  it('with raw: true, resolves to { status, body } instead of just the body', async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(reply('nope', 400)))
    const res = await httpAPI('GET', '/rfid/add', null, 'text', 60000, { raw: true })
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
      globalThis.fetch = vi.fn(() => Promise.resolve(reply({ ok: 1 })))
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

  // The charger's web server is single-threaded: a second request sent while
  // one is in flight can stall or drop either of them.
  it('sends requests to the charger one at a time, in the order they were made', async () => {
    const { fetch, answer } = heldFetch()
    globalThis.fetch = fetch
    const first = httpAPI('GET', '/config')
    const second = httpAPI('POST', '/override', '{}')
    await settle()
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch.mock.calls[0][0]).toContain('/config')

    answer({ wifi: 1 })
    expect(await first).toEqual({ wifi: 1 })
    await settle()
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch.mock.calls[1][0]).toContain('/override')
    answer({ msg: 'Created' }, 201)
    expect(await second).toEqual({ msg: 'Created' })
  })

  it('moves on to the next request when one fails', async () => {
    globalThis.fetch = vi.fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(reply({ ok: 1 }))
    const first = httpAPI('GET', '/status')
    const second = httpAPI('GET', '/status')
    expect(await first).toBe('error')
    expect(await second).toEqual({ ok: 1 })
  })

  // A request waiting behind a slow one has not reached the charger yet, so
  // its time must not run out while it waits.
  it('starts a request\'s timeout when the request is sent, not while it waits its turn', async () => {
    vi.useFakeTimers()
    try {
      globalThis.fetch = hangingFetch()
      const first = httpAPI('GET', '/status', null, 'json', 5000)
      const second = httpAPI('GET', '/config', null, 'json', 5000)
      await vi.advanceTimersByTimeAsync(5000)
      await expect(first).resolves.toBe('error')

      let settled = false
      second.then(() => { settled = true })
      await vi.advanceTimersByTimeAsync(4000)
      expect(settled).toBe(false)
      await vi.advanceTimersByTimeAsync(1000)
      await expect(second).resolves.toBe('error')
    } finally {
      vi.useRealTimers()
    }
  })

  // Pausing keeps the charger to itself, as while a firmware image uploads.
  describe('while requests are paused', () => {
    afterEach(() => resumeRequests())

    it('resolves "error" without reaching the charger', async () => {
      globalThis.fetch = vi.fn(() => Promise.resolve(reply({ ok: 1 })))
      pauseRequests()
      expect(await httpAPI('GET', '/status')).toBe('error')
      expect(await httpAPI('GET', '/status', null, 'json', 60000, { raw: true })).toBe('error')
      expect(globalThis.fetch).not.toHaveBeenCalled()
    })

    it('does not send a request that was waiting its turn when the pause began', async () => {
      const { fetch, answer } = heldFetch()
      globalThis.fetch = fetch
      const first = httpAPI('GET', '/status')
      const waiting = httpAPI('GET', '/config')
      await settle()
      pauseRequests()
      answer({ ok: 1 })
      expect(await first).toEqual({ ok: 1 })
      expect(await waiting).toBe('error')
      expect(fetch).toHaveBeenCalledTimes(1)
    })

    it('sends requests again once resumed', async () => {
      globalThis.fetch = vi.fn(() => Promise.resolve(reply({ ok: 1 })))
      pauseRequests()
      resumeRequests()
      expect(await httpAPI('GET', '/status')).toEqual({ ok: 1 })
    })
  })
})
