import { writable, type Writable } from 'svelte/store'
import { httpAPI, accepted } from '../api/httpAPI'
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
    const res = await httpAPI<LoadSharingPeer[] | ErrorBody>('GET', '/loadsharing/peers')
    if (accepted(res)) {
      update((s) => ({ ...s, peers: Array.isArray(res) ? res : [] }))
      return true
    }
    return false
  }

  async function downloadStatus(): Promise<boolean> {
    const res = await httpAPI<LoadSharingStatus | ErrorBody>('GET', '/loadsharing/status')
    if (accepted(res)) {
      update((s) => ({ ...s, status: res }))
      return true
    }
    return false
  }

  async function addPeer(host: string): Promise<boolean> {
    // "done" or "already in group": either way the peer is in the group.
    return accepted(await httpAPI<WriteResponse>('POST', '/loadsharing/peers', JSON.stringify({ host })))
  }

  async function removePeer(host: string): Promise<boolean> {
    return accepted(await httpAPI<WriteResponse>('DELETE', `/loadsharing/peers/${encodeURIComponent(host)}`))
  }

  async function setPeerPriority(host: string, priority: number): Promise<boolean> {
    const res = await httpAPI<WriteResponse>(
      'PUT',
      `/loadsharing/peers/${encodeURIComponent(host)}`,
      JSON.stringify({ priority }),
    )
    if (accepted(res)) {
      await refresh()
      return true
    }
    return false
  }

  async function discover(): Promise<boolean> {
    return accepted(await httpAPI<WriteResponse>('POST', '/loadsharing/discover'))
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
