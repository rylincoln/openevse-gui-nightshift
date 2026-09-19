import { writable, type Writable } from 'svelte/store'
import { httpAPI, isErrorBody } from '../api/httpAPI'
import type { ScheduleEvent, ErrorBody, WriteResponse } from '../api/device'

export interface ScheduleStore extends Writable<ScheduleEvent[]> {
  download(): Promise<boolean>
  upload(data: Partial<ScheduleEvent>): Promise<boolean>
  remove(id: number): Promise<boolean>
}

function createScheduleStore(): ScheduleStore {
  const P = writable<ScheduleEvent[]>([])
  const { subscribe, set, update } = P

  async function download(): Promise<boolean> {
    const res = await httpAPI<ScheduleEvent[] | ErrorBody>('GET', '/schedule')
    if (res && res !== 'error' && !isErrorBody(res)) {
      for (let t = 0; t < res.length; t++) {
        res[t].time = res[t].time.slice(0, 5) // remove useless seconds
      }
      P.update(() => res)
      return true
    } else return false
  }

  async function upload(data: Partial<ScheduleEvent>): Promise<boolean> {
    const res = await httpAPI<WriteResponse>('POST', '/schedule', JSON.stringify(data))
    if (res !== 'error' && res.msg == 'done') return true
    else return false
  }

  async function remove(id: number): Promise<boolean> {
    const res = await httpAPI<WriteResponse>('DELETE', '/schedule/' + id)
    if (res !== 'error' && res.msg == 'done') return true
    else return false
  }

  return {
    subscribe,
    set,
    update,
    download,
    remove: (id: number) => remove(id),
    upload: (schedule: Partial<ScheduleEvent>) => upload(schedule),
  }
}

export const schedule_store = createScheduleStore()
