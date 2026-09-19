// src/lib/stores/cabletemp.ts
// Cable NTC thermistor monitoring — dedicated endpoint (not /config: the
// per-source configuration is ~20 fields and /config's document capacity is
// already nearly exhausted). See openevse_esp32_firmware's
// src/web_server.cpp handleCableTemp() for the wire format.
//
// GET  /cabletemp -> {supported, enabled, sources:[{source,name,pin,status,
//                     temperature?,r25?,beta?,offset_c10?,panic_c10?} x4]}
// POST /cabletemp <- {source:0-3, pin:0-2 [,r25,beta,offset_c10,panic_c10]}
//   Omitting the four calibration fields reassigns the pin only. If any one
//   of them is present, all four must be (the controller 400s otherwise).
import { writable, type Readable, type Writable } from 'svelte/store'
import { httpAPI } from '../api/httpAPI'
import type { CableTemp, CableTempSource, WriteResponse } from '../api/device'

export interface CabletempStore extends Readable<CableTemp | null> {
  set: Writable<CableTemp | null>['set']
  download(): Promise<boolean>
  upload(
    data: Pick<CableTempSource, 'source' | 'pin'> &
      Partial<Pick<CableTempSource, 'r25' | 'beta' | 'offset_c10' | 'panic_c10'>>,
  ): Promise<boolean>
}

function createCableTempStore(): CabletempStore {
  const P = writable<CableTemp | null>(null)
  const { subscribe, set } = P

  async function download(): Promise<boolean> {
    const res = await httpAPI<CableTemp>('GET', '/cabletemp')
    if (res && res !== 'error' && Array.isArray(res.sources)) {
      set(res)
      return true
    }
    return false
  }

  async function upload(
    data: Pick<CableTempSource, 'source' | 'pin'> &
      Partial<Pick<CableTempSource, 'r25' | 'beta' | 'offset_c10' | 'panic_c10'>>,
  ): Promise<boolean> {
    const res = await httpAPI<WriteResponse>('POST', '/cabletemp', JSON.stringify(data))
    return !!(res && res !== 'error' && res.msg === 'done')
  }

  return { subscribe, set, download, upload }
}

export const cabletemp_store = createCableTempStore()
