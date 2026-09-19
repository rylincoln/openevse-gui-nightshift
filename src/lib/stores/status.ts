import { writable } from 'svelte/store'
import { httpAPI, isErrorBody } from '../api/httpAPI'
import type { Status } from '../api/device'
import type { DeviceStore } from './deviceStore'

function createStatusStore(): DeviceStore<Status> {
  const P = writable<Status | undefined>()
  const { subscribe, set, update } = P

  async function download(): Promise<boolean> {
    const res = await httpAPI<Status>('GET', '/status')
    if (res && res !== 'error' && !isErrorBody(res)) {
      P.update(() => res)
      return true
    } else {
      return false
    }
  }
  return {
    subscribe,
    set,
    update,
    download,
  }
}

export const status_store = createStatusStore()
