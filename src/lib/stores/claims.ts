import { writable, type Writable } from 'svelte/store'
import { httpAPI, isErrorBody } from '../api/httpAPI'
import type { Claim, ErrorBody } from '../api/device'

// GET /claims → array of active EVSE claims, each with its *actual* runtime
// priority (e.g. shaper claims at 1100 while timer-controlled, 5000 otherwise).
// /claims/target only maps property→winning client, so this is the source for
// the real per-client priority shown in the Claims Manager.
export interface ClaimsStore extends Writable<Claim[]> {
  download(): Promise<boolean>
}

function createClaimsStore(): ClaimsStore {
  const P = writable<Claim[]>([])
  const { subscribe, set, update } = P

  async function download(): Promise<boolean> {
    const res = await httpAPI<Claim[] | { claims?: Claim[] } | ErrorBody>('GET', '/claims')
    if (Array.isArray(res)) {
      set(res)
      return true
    }
    if (res && res !== 'error' && !isErrorBody(res)) {
      // Some firmware wraps it; accept an object with a claims array too.
      set(Array.isArray(res.claims) ? res.claims : [])
      return true
    }
    return false
  }

  return { subscribe, set, update, download }
}

export const claims_store = createClaimsStore()
