import { writable, type Writable } from 'svelte/store'
import { httpAPI, isErrorBody } from '../api/httpAPI'
import type { Config, WriteResponse } from '../api/device'

/** `/config` plus the two flags this store derives from `firmware`. */
export interface ConfigState extends Config {
  firmware_is_eu: boolean
  /** EU firmware is capped at 32 A, otherwise 80 A. */
  max_current_firmware: 32 | 80
}

export interface ConfigStore extends Writable<ConfigState | undefined> {
  download(): Promise<boolean>
  upload(data: Partial<Config>): Promise<boolean>
  saveParam<K extends keyof Config>(name: K, val: Config[K]): Promise<boolean>
}

function createConfigStore(): ConfigStore {
  const P = writable<ConfigState | undefined>()
  const { subscribe, set, update } = P

  // Helper to determine if firmware is a European variant
  function isEuropeanFirmware(fw: unknown): boolean {
    return typeof fw === 'string' && (fw.endsWith('.EU') || fw.endsWith('.T2'))
  }

  // Ensure any object placed in the store has the derived flag
  function withDerived(obj: Config | ConfigState): ConfigState {
    if (obj && typeof obj === 'object') {
      const firmware_is_eu = isEuropeanFirmware(obj.firmware)
      // EU firmware capped at 32A, otherwise 80A
      const max_current_firmware: 32 | 80 = firmware_is_eu ? 32 : 80
      return { ...obj, firmware_is_eu, max_current_firmware }
    }
    return obj as ConfigState
  }

  async function download(): Promise<boolean> {
    const res = await httpAPI<Config>('GET', '/config')
    if (res && res !== 'error' && !isErrorBody(res)) {
      P.update(() => withDerived(res))
      return true
    } else return false
  }

  async function upload(data: Partial<Config>): Promise<boolean> {
    const res = await httpAPI<WriteResponse>('POST', '/config', JSON.stringify(data))
    if (res !== 'error' && (res.msg == 'done' || res.msg == 'no change')) return true
    else return false
  }

  async function saveParam<K extends keyof Config>(name: K, val: Config[K]): Promise<boolean> {
    const data = { [name]: val } as Partial<Config>
    if (await config_store.upload(data)) {
      // After a successful param save we should refresh (lightweight: update current object)
      update((current) => withDerived({ ...current, [name]: val } as ConfigState))
      return true
    } else {
      return false
    }
  }

  // Wrapped set/update so external callers always get derived property maintained
  function setWithDerived(value: ConfigState | undefined): void {
    set(value ? withDerived(value) : value)
  }
  function updateWithDerived(
    fn: (c: ConfigState | undefined) => ConfigState | undefined,
  ): void {
    update((curr) => {
      const next = fn(curr)
      return next ? withDerived(next) : next
    })
  }

  return {
    subscribe,
    set: setWithDerived,
    update: updateWithDerived,
    download,
    upload,
    saveParam,
  }
}

export const config_store = createConfigStore()
