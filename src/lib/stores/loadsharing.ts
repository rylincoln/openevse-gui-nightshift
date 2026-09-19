import { writable, type Writable } from 'svelte/store'
import { httpAPI, isErrorBody, type ApiResult } from '../api/httpAPI'
import { serialQueue } from '../queue.js'
import type { LoadSharingPeer, LoadSharingStatus, ErrorBody, WriteResponse } from '../api/device'

export interface LoadSharingState {
  peers: LoadSharingPeer[]
  status: LoadSharingStatus | null
}

export interface LoadSharingStore extends Writable<LoadSharingState> {
  downloadPeers(): Promise<boolean>
  downloadStatus(): Promise<boolean>
  addPeer(host: string): Promise<boolean>
  removePeer(host: string): Promise<boolean>
  setPeerPriority(host: string, priority: number): Promise<boolean>
  discover(): Promise<boolean>
  refresh(): Promise<boolean>
}

function createLoadSharingStore(): LoadSharingStore {
  const P = writable<LoadSharingState>({ peers: [], status: null })
  const { subscribe, set, update } = P

  async function downloadPeers(): Promise<boolean> {
    const res: ApiResult<LoadSharingPeer[] | ErrorBody> = await serialQueue.add(() =>
      httpAPI<LoadSharingPeer[] | ErrorBody>('GET', '/loadsharing/peers'),
    )
    if (res && res !== 'error' && !isErrorBody(res)) {
      update((s) => ({ ...s, peers: Array.isArray(res) ? res : [] }))
      return true
    }
    return false
  }

  async function downloadStatus(): Promise<boolean> {
    const res: ApiResult<LoadSharingStatus | ErrorBody> = await serialQueue.add(() =>
      httpAPI<LoadSharingStatus | ErrorBody>('GET', '/loadsharing/status'),
    )
    if (res && res !== 'error' && !isErrorBody(res)) {
      update((s) => ({ ...s, status: res }))
      return true
    }
    return false
  }

  async function addPeer(host: string): Promise<boolean> {
    const res: ApiResult<WriteResponse> = await serialQueue.add(() =>
      httpAPI<WriteResponse>('POST', '/loadsharing/peers', JSON.stringify({ host })),
    )
    return res !== 'error' && (res.msg === 'done' || res.msg === 'already in group')
  }

  async function removePeer(host: string): Promise<boolean> {
    const res: ApiResult<WriteResponse> = await serialQueue.add(() =>
      httpAPI<WriteResponse>('DELETE', `/loadsharing/peers/${encodeURIComponent(host)}`),
    )
    return res !== 'error' && res.msg === 'done'
  }

  async function setPeerPriority(host: string, priority: number): Promise<boolean> {
    const res: ApiResult<WriteResponse> = await serialQueue.add(() =>
      httpAPI<WriteResponse>(
        'PUT',
        `/loadsharing/peers/${encodeURIComponent(host)}`,
        JSON.stringify({ priority }),
      ),
    )
    if (res !== 'error' && res.msg === 'done') {
      await refresh()
      return true
    }
    return false
  }

  async function discover(): Promise<boolean> {
    const res: ApiResult<WriteResponse> = await serialQueue.add(() =>
      httpAPI<WriteResponse>('POST', '/loadsharing/discover'),
    )
    return res !== 'error' && res.msg === 'done'
  }

  async function refresh(): Promise<boolean> {
    const peersOk = await downloadPeers()
    const statusOk = await downloadStatus()
    return peersOk || statusOk
  }

  return {
    subscribe,
    set,
    update,
    downloadPeers,
    downloadStatus,
    addPeer,
    removePeer,
    setPeerPriority,
    discover,
    refresh,
  }
}

export const loadsharing_store = createLoadSharingStore()
