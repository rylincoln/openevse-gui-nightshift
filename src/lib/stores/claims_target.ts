import './../../lib/vars'
import { get, writable, type Writable } from 'svelte/store'
import { httpAPI, accepted } from '../api/httpAPI'
import type { ErrorBody } from '../api/device'
import model from './json/claims_target.json'

export interface ClaimsTargetProperties {
  state: string | null
  charge_current: number | null
  auto_release: boolean | null
  /** The winning current cap, in amps. Present only while a client (the load
   * shaper, load sharing) caps the current. */
  max_current?: number | null
}

export interface ClaimsTargetClaims {
  state: number | null
  charge_current: number | null
  /** The client setting the current cap; present only while one does. */
  max_current?: number | null
  auto_release?: boolean | null
}

export interface ClaimsTargetModel {
  properties?: ClaimsTargetProperties
  claims?: ClaimsTargetClaims
}

export interface ClaimsTargetStore extends Writable<ClaimsTargetModel> {
  get: typeof get
  download(): Promise<boolean>
}

function createClaimsTargetStore(): ClaimsTargetStore {
  const P = writable<ClaimsTargetModel>(model)
  const { subscribe, set, update } = P

  // get claims/target
  async function download(): Promise<boolean> {
    const res = await httpAPI<ClaimsTargetModel | ErrorBody>('GET', '/claims/target')
    if (!accepted(res)) {
      P.update(() => ({}))
      return false
    } else {
      P.update(() => res)
      return true
    }
  }

  return {
    subscribe,
    get: (s) => get(s), // little hack to access get() method inside the object itself
    set,
    update,
    download,
  }
}

export const claims_target_store = createClaimsTargetStore()
