// Per-field save machinery shared by every config page. createConfigForm()
// returns a saveState store, a `revert` counter (bumped on failure so
// controlled inputs resync to the confirmed store value), and the save fns.
import { config_store, type ConfigState } from '../stores/config'
import { serialQueue } from '../queue'
import { showWriteError } from '../alerts'
import { createSaveState, type SaveStateStore } from './saveState'
import type { Config } from '../api/device'

export interface ConfigForm {
  saveState: SaveStateStore
  saveField<K extends keyof Config>(name: K, value: Config[K]): Promise<boolean>
  saveFields(fields: Partial<Config>): Promise<boolean>
  readonly revert: number
}

export function createConfigForm(): ConfigForm {
  const saveState = createSaveState()
  let revert = $state(0)

  async function saveFields(fields: Partial<Config>): Promise<boolean> {
    const names = Object.keys(fields)
    names.forEach((n) => saveState.begin(n))
    const ok = await serialQueue.add(() => config_store.upload(fields))
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

  function saveField<K extends keyof Config>(name: K, value: Config[K]): Promise<boolean> {
    return saveFields({ [name]: value } as Partial<Config>)
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
