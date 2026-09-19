import './../../lib/vars'
import { get, writable, type Writable } from 'svelte/store'
import { httpAPI, isErrorBody } from '../api/httpAPI'
import type { ErrorBody } from '../api/device'
import model from './json/claims_target.json'

export interface ClaimsTargetProperties {
  state: string | null
  charge_current: number | null
  auto_release: boolean | null
  /** Not part of the real device payload (dev/fixtures/claims_target.json); a
   * legacy field from the store's seed model, still optionally read by
   * src/routes/settings/LoadSharing.svelte. */
  max_current?: number | null
}

export interface ClaimsTargetClaims {
  state: number | null
  charge_current: number | null
  /** Legacy seed-model field; the device payload does not send this. */
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
    if (res === 'error' || isErrorBody(res)) {
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
