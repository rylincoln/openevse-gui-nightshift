import { writable, type Writable } from 'svelte/store'
import { httpAPI, isErrorBody } from '../api/httpAPI'
import type { Certificate, ErrorBody, WriteResponse } from '../api/device'

export interface CertificateStore extends Writable<Certificate[]> {
  download(): Promise<boolean>
  upload(data: Partial<Certificate>): Promise<WriteResponse & { success: boolean }>
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
    if (res && res !== 'error' && !isErrorBody(res)) {
      P.update(() => res)
      return true
    } else return false
  }

  async function upload(data: Partial<Certificate>): Promise<WriteResponse & { success: boolean }> {
    // The device is trusted to answer with a write response here; the
    // original code mutates the response in place without first excluding
    // httpAPI's 'error' sentinel, so a network failure still throws exactly
    // as it did before this file was typed.
    const res = (await httpAPI('POST', '/certificates', JSON.stringify(data))) as WriteResponse & {
      success: boolean
    }
    res.success = res.msg == 'done'
    return res
  }

  // Asks the firmware to generate a self-signed certificate/key pair and store
  // it. Generation happens on-device because the private key must never leave
  // it. Native/OpenSSL builds answer 501 -- mbedTLS is the only backend that
  // implements this -- so surface the firmware's message rather than a generic
  // failure.
  async function generateSelfSigned(): Promise<
    { success: true; id?: string } | { success: false; msg: string | null }
  > {
    const res = await httpAPI<WriteResponse & { id?: string }>('POST', '/certificates/self-signed')
    if (res && res !== 'error' && res.msg == 'done') {
      return { success: true, id: res.id }
    }
    return { success: false, msg: res && res !== 'error' && res.msg ? res.msg : null }
  }

  async function remove(id: string): Promise<boolean> {
    const res = await httpAPI<WriteResponse>('DELETE', '/certificates/' + id)
    if (res !== 'error' && res.msg == 'done') return true
    else return false
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
