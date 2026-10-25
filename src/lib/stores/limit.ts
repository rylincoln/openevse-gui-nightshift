import { writable, type Writable } from 'svelte/store'
import { httpAPI, accepted } from '../api/httpAPI'
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
    const res = await httpAPI<Limit | WriteResponse | Record<string, never>>('GET', '/limit')
    if (!accepted(res)) return false
    // No limit is {} — or, before firmware v5, {"msg":"no limit"}.
    P.update(() => ('type' in res ? (res as Limit) : model))
    return true
  }

  async function upload(data: Partial<Limit>): Promise<boolean> {
    return accepted(await httpAPI<WriteResponse>('POST', '/limit', JSON.stringify(data)))
  }

  async function remove(_id?: unknown): Promise<boolean> {
    // With no limit set the charger still answers 200 ("no limit"): the
    // remove is idempotent.
    if (accepted(await httpAPI<WriteResponse>('DELETE', '/limit'))) {
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
