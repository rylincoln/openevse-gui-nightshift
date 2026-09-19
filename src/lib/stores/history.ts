import { writable, get, type Writable } from 'svelte/store'
import { httpAPI, isErrorBody } from '../api/httpAPI'
import { dedup } from '../utils.js'
import type { LogEntry, ErrorBody } from '../api/device'

export interface HistoryStore extends Writable<LogEntry[] | undefined> {
  get: typeof get
  download(index: number): Promise<boolean>
}

function createHistoryStore(): HistoryStore {
  const P = writable<LogEntry[] | undefined>()
  const { subscribe, set, update } = P

  async function download(index: number): Promise<boolean> {
    const res = await httpAPI<LogEntry[] | ErrorBody>('GET', '/logs/' + index)
    if (res && res !== 'error' && !isErrorBody(res)) {
      const prevData = get(P)
      if (prevData) {
        const newData = [...prevData, ...res]
        const cleanData: LogEntry[] = dedup(newData)
        // sorting data
        cleanData.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
        P.update(() => cleanData)
      } else {
        P.update(() => res)
      }
      return true
    } else return false
  }

  return {
    subscribe,
    set,
    get: (s) => get(s), // little hack to access get() method inside the object itself
    update,
    download: (index: number) => download(index),
  }
}

export const history_store = createHistoryStore()
