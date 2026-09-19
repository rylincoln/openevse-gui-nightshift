import { writable, type Writable } from 'svelte/store'
import { httpAPI, type ApiResult } from '../api/httpAPI'
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

export interface BoostStore extends Writable<Boost> {
  download(): Promise<boolean>
  upload(data: Partial<Boost>): Promise<ApiResult<WriteResponse>>
  remove(): Promise<boolean>
  reset(): boolean
}

function createBoostStore(): BoostStore {
  const P = writable<Boost>(model)
  const { subscribe, set, update } = P

  async function download(): Promise<boolean> {
    const res = await httpAPI<Boost | Record<string, never>>('GET', '/boost')
    if (res && res !== 'error' && 'type' in res) {
      // Active: {type, value, remaining, started}
      P.update(() => res as Boost)
      return true
    } else if (res && res !== 'error' && typeof res === 'object') {
      // {} = idle. On firmware without Boost, GET /boost 404s with a
      // non-JSON body, so httpAPI's response.json() throws and the catch
      // returns the string 'error' → the failure branch below. (httpAPI
      // does NOT translate the 404 itself; it only special-cases 401.
      // It never exposes the status code either, which is why the
      // capability check is a boost_version gate in DataManager, not a
      // 200-vs-404 probe here — and that gate means an unsupported device
      // never reaches this download at all.)
      P.update(() => model)
      return true
    } else return false
  }

  async function upload(data: Partial<Boost>): Promise<ApiResult<WriteResponse>> {
    // Returns the parsed body so the caller can distinguish:
    //   201 {msg:"done"}                    → armed / replaced
    //   400 {msg:"failed to parse JSON"}    → rejected input
    //   422 {msg:"no vehicle data source…"} → no soc/range source
    //   'error'                             → network / parse failure
    // Never infer "a boost is now running" from the 201 — an already-met
    // soc/range target also returns 201 but leaves nothing running. The
    // caller reconciles from download()/boost_version.
    return await httpAPI<WriteResponse>('POST', '/boost', JSON.stringify(data))
  }

  async function remove(): Promise<boolean> {
    const res = await httpAPI<WriteResponse>('DELETE', '/boost')
    // "no boost" = nothing to cancel — success for an idempotent remove,
    // mirroring how the limit store treats "no limit". Note this reply
    // arrives with a 404 status: it works because httpAPI passes every
    // non-401 response straight to response.json(), so the {"msg":"no
    // boost"} body parses normally. If httpAPI were ever changed to
    // collapse 404s to 'error', idempotent cancel would silently break —
    // this path depends on the 404 body being parsed, not swallowed.
    if (res && res !== 'error' && (res.msg === 'done' || res.msg === 'no boost')) {
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
