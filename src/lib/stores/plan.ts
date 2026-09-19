import { writable, type Writable } from 'svelte/store'
import { httpAPI, isErrorBody } from '../api/httpAPI'
import type { Plan } from '../api/device'

export interface PlanStore extends Writable<Plan | undefined> {
  download(): Promise<boolean>
}

function createPlanStore(): PlanStore {
  const P = writable<Plan | undefined>()
  const { subscribe, set, update } = P

  async function download(): Promise<boolean> {
    const res = await httpAPI<Plan>('GET', '/schedule/plan')
    if (res && res !== 'error' && !isErrorBody(res)) {
      P.update(() => res)
      return true
    } else return false
  }

  return {
    subscribe,
    set,
    update,
    download,
  }
}

export const plan_store = createPlanStore()
