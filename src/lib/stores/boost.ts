import { writable, type Writable } from 'svelte/store'
import { httpAPI, accepted } from '../api/httpAPI'
import type { Boost, WriteResponse } from '../api/device'

// Boost = "charge NOW until a target is reached, then hand control back."
// A dedicated device-side claim (priority 200) owns the countdown — the UI
// only arms/cancels and mirrors what the device reports. Never persisted; a
// reboot clears it. See src/lib/stores/limit.ts for the sibling pattern this
// deliberately mirrors.
//
// Idle is the empty object {} from GET /boost (a 200, NOT a 404) — normalised
// here to this model so consumers can test `type !== 'none'` uniformly.
const model: Boost = {
  type: 'none',
  value: 0,
}

/** Arming a boost: accepted, or refused with the charger's reason when it gives one. */
export type BoostArmResult = { ok: true } | { ok: false; reason?: string }

export interface BoostStore extends Writable<Boost> {
  download(): Promise<boolean>
  upload(data: Partial<Boost>): Promise<BoostArmResult>
  remove(): Promise<boolean>
  reset(): boolean
}

function createBoostStore(): BoostStore {
  const P = writable<Boost>(model)
  const { subscribe, set, update } = P

  async function download(): Promise<boolean> {
    const res = await httpAPI<Boost | Record<string, never>>('GET', '/boost')
    // Firmware without Boost 404s, which is 'error' here; the capability
    // check is the boost_version gate in DataManager, so an unsupported
    // device never reaches this download at all.
    if (!accepted(res) || typeof res !== 'object') return false
    // Active: {type, value, remaining, started}; {} = idle.
    P.update(() => ('type' in res ? (res as Boost) : model))
    return true
  }

  async function upload(data: Partial<Boost>): Promise<BoostArmResult> {
    //   201 {msg:"done"}                    → armed / replaced
    //   400 {msg:"failed to parse JSON"}    → rejected input
    //   422 {msg:"no vehicle data source…"} → no soc/range source
    // Never infer "a boost is now running" from the 201 — an already-met
    // soc/range target also returns 201 but leaves nothing running. The
    // caller reconciles from download()/boost_version.
    const res = await httpAPI<WriteResponse>('POST', '/boost', JSON.stringify(data), 'json', 60000, { raw: true })
    if (res === 'error') return { ok: false }
    if (res.status >= 200 && res.status < 300) return { ok: true }
    return { ok: false, reason: res.body?.msg }
  }

  async function remove(): Promise<boolean> {
    const res = await httpAPI<WriteResponse>('DELETE', '/boost', null, 'json', 60000, { raw: true })
    // A 404 ("no boost") means nothing to cancel — success for an idempotent
    // remove, as the limit store treats "no limit".
    if (res !== 'error' && ((res.status >= 200 && res.status < 300) || res.status === 404)) {
      P.update(() => model)
      return true
    } else return false
  }

  function reset(): boolean {
    P.update(() => model)
    return true
  }

  return {
    subscribe,
    set,
    update,
    download,
    reset,
    remove,
    upload,
  }
}

export const boost_store = createBoostStore()
