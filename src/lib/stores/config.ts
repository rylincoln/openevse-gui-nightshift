import { writable, type Writable } from 'svelte/store'
import { httpAPI, accepted } from '../api/httpAPI'
import type { Config, WriteResponse } from '../api/device'

/** `/config` plus the two flags this store derives from `firmware`. */
export interface ConfigState extends Config {
  firmware_is_eu: boolean
  /** EU firmware is capped at 32 A, otherwise 80 A. */
  max_current_firmware: 32 | 80
}

export interface ConfigStore extends Writable<ConfigState | undefined> {
  download(): Promise<boolean>
  /** POST /config. Pages write through createConfigForm (config/configForm.svelte.ts), not this. */
  upload(data: Partial<Config>): Promise<boolean>
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
    if (accepted(res)) {
      P.update(() => withDerived(res))
      return true
    } else return false
  }

  async function upload(data: Partial<Config>): Promise<boolean> {
    // "done" or "no change": either way the charger holds these values now.
    return accepted(await httpAPI<WriteResponse>('POST', '/config', JSON.stringify(data)))
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
  }
}

export const config_store = createConfigStore()
