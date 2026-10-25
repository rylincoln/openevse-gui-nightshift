// Per-field save machinery shared by every config page. createConfigForm()
// returns a saveState store, a `revert` counter (bumped on failure so
// controlled inputs resync to the confirmed store value), and the save fns.
import { config_store, type ConfigState } from '../stores/config'
import { showWriteError } from '../alerts'
import { createSaveState, type SaveStateStore } from './saveState'
import type { Config } from '../api/device'

export interface ConfigForm {
  saveState: SaveStateStore
  /**
   * Save one field; true once the charger holds the new value. null means
   * the field was cleared to empty (NumberInput): a field that shows a
   * fallback while unset gets that fallback written; any other is left as
   * the charger holds it and the input put back, which is not a failure.
   */
  saveField<K extends keyof Config>(name: K, value: Config[K] | null): Promise<boolean>
  saveFields(fields: Partial<Config>): Promise<boolean>
  readonly revert: number
}

// What a cleared field writes: the value its input shows while the charger
// has none set. Every other field writes nothing when cleared — a literal
// null would land in the firmware's config as 0 or an empty string.
const CLEARED: Partial<Config> = {
  www_https_port: 443,
  loadsharing_rotation_interval: 1800,
  scheduler_start_window: 0,
  scale: 0,
  offset: 0,
}

export function createConfigForm(): ConfigForm {
  const saveState = createSaveState()
  let revert = $state(0)

  async function saveFields(fields: Partial<Config>): Promise<boolean> {
    const names = Object.keys(fields)
    names.forEach((n) => saveState.begin(n))
    const ok = await config_store.upload(fields)
    if (ok) {
      config_store.update((c) => ({ ...c, ...fields }) as ConfigState)
      names.forEach((n) => saveState.succeed(n))
    } else {
      names.forEach((n) => saveState.fail(n))
      revert += 1
      showWriteError()
    }
    return ok
  }

  async function saveField<K extends keyof Config>(name: K, value: Config[K] | null): Promise<boolean> {
    const next = value ?? CLEARED[name]
    if (next === undefined) {
      revert += 1
      return false
    }
    return saveFields({ [name]: next } as Partial<Config>)
  }

  return {
    saveState,
    saveField,
    saveFields,
    get revert() {
      return revert
    },
  }
}
