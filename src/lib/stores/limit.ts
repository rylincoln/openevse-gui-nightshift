import { writable, type Writable } from 'svelte/store'
import { httpAPI } from '../api/httpAPI'
import type { Limit, WriteResponse } from '../api/device'

const model: Limit = {
  type: 'none',
  value: 0,
  auto_release: true,
}

export interface LimitStore extends Writable<Limit> {
  download(): Promise<boolean>
  upload(data: Partial<Limit>): Promise<boolean>
  remove(id?: unknown): Promise<boolean>
  reset(): boolean
}

function createLimitStore(): LimitStore {
  const P = writable<Limit>(model)
  const { subscribe, set, update } = P

  async function download(): Promise<boolean> {
    const res = await httpAPI<Limit | WriteResponse>('GET', '/limit')
    if (res && res !== 'error' && 'type' in res) {
      P.update(() => res)
      return true
    } else if (res && res !== 'error' && 'msg' in res && res.msg == 'no limit') {
      // reset limit to default
      P.update(() => model)
      return true
    } else return false
  }

  async function upload(data: Partial<Limit>): Promise<boolean> {
    const res = await httpAPI<WriteResponse>('POST', '/limit', JSON.stringify(data))
    if (res !== 'error' && res.msg == 'done') return true
    else return false
  }

  async function remove(_id?: unknown): Promise<boolean> {
    const res = await httpAPI<WriteResponse>('DELETE', '/limit')
    // "no limit" = nothing to delete — success for an idempotent remove
    if (res !== 'error' && (res.msg == 'done' || res.msg == 'no limit')) {
      P.update(() => model)
      return true
    } else return false
  }

  function reset(): boolean {
    P.update(() => model)
    return true
  }

  return { subscribe, set, update, download, reset, remove, upload }
}

export const limit_store = createLimitStore()
