import { writable, type Writable } from 'svelte/store'
import { httpAPI, accepted } from '../api/httpAPI'
import type { Certificate, ErrorBody, WriteResponse } from '../api/device'

export interface CertificateStore extends Writable<Certificate[]> {
  download(): Promise<boolean>
  upload(data: Partial<Certificate>): Promise<boolean>
  remove(id: string): Promise<boolean>
  generateSelfSigned(): Promise<
    { success: true; id?: string } | { success: false; msg: string | null }
  >
}

function createCertificateStore(): CertificateStore {
  const P = writable<Certificate[]>([])
  const { subscribe, set, update } = P

  async function download(): Promise<boolean> {
    const res = await httpAPI<Certificate[] | ErrorBody>('GET', '/certificates')
    if (accepted(res)) {
      P.update(() => res)
      return true
    } else return false
  }

  async function upload(data: Partial<Certificate>): Promise<boolean> {
    return accepted(await httpAPI<WriteResponse>('POST', '/certificates', JSON.stringify(data)))
  }

  // Asks the firmware to generate a self-signed certificate/key pair and store
  // it. Generation happens on-device because the private key must never leave
  // it. Native/OpenSSL builds answer 501 -- mbedTLS is the only backend that
  // implements this -- so surface the firmware's message rather than a generic
  // failure.
  async function generateSelfSigned(): Promise<
    { success: true; id?: string } | { success: false; msg: string | null }
  > {
    const res = await httpAPI<WriteResponse & { id?: string }>(
      'POST', '/certificates/self-signed', null, 'json', 60000, { raw: true })
    if (res === 'error') return { success: false, msg: null }
    if (res.status >= 200 && res.status < 300) return { success: true, id: res.body?.id }
    return { success: false, msg: res.body?.msg || null }
  }

  async function remove(id: string): Promise<boolean> {
    return accepted(await httpAPI<WriteResponse>('DELETE', '/certificates/' + id))
  }

  return {
    subscribe,
    set,
    update,
    download,
    remove: (id: string) => remove(id),
    generateSelfSigned,
    upload: (certificate: Partial<Certificate>) => upload(certificate),
  }
}

export const certificate_store = createCertificateStore()
