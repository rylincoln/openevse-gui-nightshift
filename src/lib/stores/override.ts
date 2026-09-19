import { get, writable, type Writable } from 'svelte/store'
import { httpAPI } from '../api/httpAPI'
import { status_store } from './status'
import type { Override, ErrorBody, WriteResponse } from '../api/device'

// const model = {
// 	// state: undefined,
//     // max_current: undefined,
//     // charge_current: undefined,
//     // auto_release: undefined,
//     // msg: undefined
//   }

function createOverrideStore(): Writable<Override | undefined> & {
  get: typeof get
  download(): Promise<boolean>
  upload(data: Override): Promise<boolean>
  clear(): Promise<boolean>
  toggle(): Promise<boolean>
  removeProp(prop: keyof Override): Promise<boolean>
} {
  const P = writable<Override | undefined>()
  const { subscribe, set, update } = P

  async function download(): Promise<boolean> {
    const res = await httpAPI<Override | ErrorBody>('GET', '/override')
    if (res && res !== 'error' && !('msg' in res)) {
      P.update(() => res)
      return true
    } else if (res && res !== 'error' && 'msg' in res && res.msg === 'No manual override') {
      const store: Override = {}
      P.update(() => store)
      return true
    } else {
      return false
    }
  }
  async function upload(data: Override): Promise<boolean> {
    const res = await httpAPI<WriteResponse>('POST', '/override', JSON.stringify(data))
    // Update the store only on a confirmed success — never show an
    // override the device did not accept. httpAPI yields "error" on a
    // failed request; a msg:"error" body is also a failure.
    if (res && res !== 'error' && res?.msg !== 'error') {
      P.update(() => data)
      return true
    }
    return false
  }
  async function clear(): Promise<boolean> {
    if (get(override_store)) {
      const res = await httpAPI('DELETE', '/override')
      if (res) {
        const store: Override = {}
        P.update(() => store)
        return true
      } else return false
    } else return false
  }

  async function toggle(): Promise<boolean> {
    const res = await httpAPI<WriteResponse>('PATCH', '/override')
    if (res !== 'error' && res.msg === 'Updated') {
      return true
    } else return false
  }

  async function removeProp(prop: keyof Override): Promise<boolean> {
    const override = get(P) as Override
    let res
    if (override[prop]) {
      // override has prop
      delete override[prop]
      if (Object.keys(override).length == 1 && override.auto_release != undefined) {
        // there's only one key check if it's auto_release
        res = await override_store.clear()
        return res
      } else {
        res = await override_store.upload(override)
        return res
      }
    }
    return false
  }

  return {
    subscribe,
    get: (s) => get(s), // little hack to access get() method inside the object itself
    set,
    update,
    download,
    clear,
    upload,
    toggle,
    removeProp,
  }
}

export const override_store = createOverrideStore()
