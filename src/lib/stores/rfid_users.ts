import { writable, type Readable, type Writable } from 'svelte/store'
import { httpAPI, type ApiResult } from '../api/httpAPI'
import { serialQueue } from '../queue'
import type { RfidUsers, ErrorBody, WriteResponse } from '../api/device'

// Holds the firmware's UID → user-name map. Backed by /rfid/users on devices
// that support it; we treat any non-object response (404, HTML error, etc.)
// as "feature unavailable" and surface that via the error flag rather than
// crashing the page.
export interface RfidUsersState {
  users: RfidUsers
  loading: boolean
  error: boolean
}

function emptyState(): RfidUsersState {
  return { users: {}, loading: false, error: false }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

export interface RfidUsersStore extends Readable<RfidUsersState> {
  set: Writable<RfidUsersState>['set']
  reset(): void
  download(): Promise<boolean>
  save(uid: string, name: string): Promise<boolean>
  remove(uid: string): Promise<boolean>
}

function createRfidUsersStore(): RfidUsersStore {
  const P = writable<RfidUsersState>(emptyState())
  const { subscribe, set, update } = P

  async function download(): Promise<boolean> {
    update((s) => ({ ...s, loading: true, error: false }))
    const res: ApiResult<RfidUsers | ErrorBody> | false = await serialQueue.add(() =>
      httpAPI<RfidUsers | ErrorBody>('GET', '/rfid/users'),
    )
    if (!res || res === 'error' || res.msg === 'error' || !isPlainObject(res)) {
      update((s) => ({ ...s, loading: false, error: true }))
      return false
    }
    set({ users: res as RfidUsers, loading: false, error: false })
    return true
  }

  async function save(uid: string, name: string): Promise<boolean> {
    const body = JSON.stringify({ rfid: uid, name })
    const res: ApiResult<WriteResponse> | false = await serialQueue.add(() =>
      httpAPI<WriteResponse>('POST', '/rfid/users', body),
    )
    if (!res || res === 'error' || res.msg === 'error') return false
    update((s) => ({ ...s, users: { ...s.users, [uid]: name } }))
    return true
  }

  async function remove(uid: string): Promise<boolean> {
    const url = `/rfid/users?rfid=${encodeURIComponent(uid)}`
    const res: ApiResult<WriteResponse> | false = await serialQueue.add(() =>
      httpAPI<WriteResponse>('DELETE', url),
    )
    if (!res || res === 'error' || res.msg === 'error') return false
    update((s) => {
      const next = { ...s.users }
      delete next[uid]
      return { ...s, users: next }
    })
    return true
  }

  return {
    subscribe,
    set,
    reset: () => set(emptyState()),
    download,
    save,
    remove,
  }
}

export const rfid_users_store = createRfidUsersStore()
