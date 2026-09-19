// Per-field save-status state. createSaveState() returns a Svelte store
// mapping field name -> 'saving' | 'saved' | 'error'. A name absent from the
// map is 'idle'. succeed() lingers on 'saved' then auto-clears to 'idle'.
import { writable, get, type Readable } from 'svelte/store'

export const SAVED_LINGER_MS = 2000

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export interface SaveStateStore extends Readable<Record<string, SaveStatus>> {
  begin(name: string): void
  succeed(name: string): void
  fail(name: string): void
  statusOf(name: string): SaveStatus
}

export function createSaveState(): SaveStateStore {
  const store = writable<Record<string, SaveStatus>>({})
  const { subscribe, update } = store
  const timers: Record<string, ReturnType<typeof setTimeout>> = {}

  function clearTimer(name: string): void {
    if (timers[name]) {
      clearTimeout(timers[name])
      delete timers[name]
    }
  }
  function setStatus(name: string, status: SaveStatus): void {
    update((m) => ({ ...m, [name]: status }))
  }

  return {
    subscribe,
    begin(name) {
      clearTimer(name)
      setStatus(name, 'saving')
    },
    succeed(name) {
      clearTimer(name)
      setStatus(name, 'saved')
      timers[name] = setTimeout(() => {
        delete timers[name]
        setStatus(name, 'idle')
      }, SAVED_LINGER_MS)
    },
    fail(name) {
      clearTimer(name)
      setStatus(name, 'error')
    },
    statusOf(name) {
      return get(store)[name] ?? 'idle'
    },
  }
}
