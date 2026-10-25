import { describe, it, expect, vi, beforeEach } from 'vitest'
import { get } from 'svelte/store'

vi.mock('../../api/httpAPI', async (importOriginal) => ({
  ...(await importOriginal()),
  httpAPI: vi.fn()
}))

import { certificate_store } from '../certificates'
import { httpAPI } from '../../api/httpAPI'

describe('certificate_store', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    certificate_store.set([])
  })

  it('should have all required methods', () => {
    expect(typeof certificate_store.subscribe).toBe('function')
    expect(typeof certificate_store.download).toBe('function')
    expect(typeof certificate_store.upload).toBe('function')
    expect(typeof certificate_store.remove).toBe('function')
  })

  // The firmware explains a refusal (501 on builds without mbedTLS), so the
  // request reads the status and the body together.
  it('generates a self-signed certificate', async () => {
    httpAPI.mockResolvedValue({ status: 200, body: { msg: 'done', id: 'abc123' } })

    const result = await certificate_store.generateSelfSigned()
    expect(httpAPI).toHaveBeenCalledWith('POST', '/certificates/self-signed', null, 'json', 60000, { raw: true })
    expect(result).toEqual({ success: true, id: 'abc123' })
  })

  it('passes the firmware message through when self-signing is unavailable', async () => {
    httpAPI.mockResolvedValue({
      status: 501,
      body: { msg: 'Self-signed certificate generation is not available in native builds.' },
    })

    const result = await certificate_store.generateSelfSigned()
    expect(result.success).toBe(false)
    expect(result.msg).toContain('not available')
  })

  it('reports no message when the charger cannot be reached', async () => {
    httpAPI.mockResolvedValue('error')
    expect(await certificate_store.generateSelfSigned()).toEqual({ success: false, msg: null })
  })

  it('should download certificates', async () => {
    const mockCerts = [
      { id: 1, name: 'cert1' },
      { id: 2, name: 'cert2' }
    ]
    httpAPI.mockResolvedValue(mockCerts)

    const result = await certificate_store.download()
    expect(result).toBe(true)
    expect(httpAPI).toHaveBeenCalledWith('GET', '/certificates')

    const state = get(certificate_store)
    expect(state).toHaveLength(2)
    expect(state[0].name).toBe('cert1')
  })

  it('should return false on download error', async () => {
    httpAPI.mockResolvedValue('error')
    const result = await certificate_store.download()
    expect(result).toBe(false)
  })

  it('uploads a certificate, reporting the charger accepted it', async () => {
    httpAPI.mockResolvedValue({ msg: 'done' })
    const data = { name: 'newcert', pem: '...' }
    expect(await certificate_store.upload(data)).toBe(true)
    expect(httpAPI).toHaveBeenCalledWith('POST', '/certificates', JSON.stringify(data))
  })

  it.each([['error'], [{ msg: 'error' }]])('reports a refused or failed upload (%j)', async (reply) => {
    httpAPI.mockResolvedValue(reply)
    expect(await certificate_store.upload({ name: 'newcert', pem: '...' })).toBe(false)
  })

  it('should remove certificate by id', async () => {
    httpAPI.mockResolvedValue({ msg: 'done' })
    const result = await certificate_store.remove(1)
    expect(result).toBe(true)
    expect(httpAPI).toHaveBeenCalledWith('DELETE', '/certificates/1')
  })

  it('should return false on remove failure', async () => {
    httpAPI.mockResolvedValue({ msg: 'error' })
    const result = await certificate_store.remove(1)
    expect(result).toBe(false)
  })
})
