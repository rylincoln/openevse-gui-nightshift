import { writable } from 'svelte/store'
import { httpAPI, accepted } from '../api/httpAPI'
import type { Status } from '../api/device'
import type { DeviceStore } from './deviceStore'

function createStatusStore(): DeviceStore<Status> {
  const P = writable<Status | undefined>()
  const { subscribe, set, update } = P

  async function download(): Promise<boolean> {
    const res = await httpAPI<Status>('GET', '/status')
    if (accepted(res)) {
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
