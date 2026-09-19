import { writable, get, type Readable, type Writable } from 'svelte/store'
import { httpAPI, isErrorBody, type ApiResult } from '../api/httpAPI'
import { serialQueue } from '../queue.js'
import type {
  EnergyRaw,
  EnergyDaily,
  EnergyMonthly,
  EnergyAnnual,
  EnergySample,
  ErrorBody,
} from '../api/device'

export interface EnergyRawState {
  samples: EnergySample[]
  historical: boolean
  noOlder: boolean
  before: number
}

export interface EnergyLoadingState {
  raw: boolean
  daily: boolean
  monthly: boolean
  annual: boolean
}

export interface EnergyState {
  raw: EnergyRawState
  daily: EnergyDaily['daily']
  monthly: EnergyMonthly['monthly']
  annual: EnergyAnnual['annual']
  loading: EnergyLoadingState
  error: EnergyLoadingState
}

function emptyState(): EnergyState {
  return {
    raw: { samples: [], historical: false, noOlder: false, before: 0 },
    daily: [],
    monthly: [],
    annual: [],
    loading: { raw: false, daily: false, monthly: false, annual: false },
    error: { raw: false, daily: false, monthly: false, annual: false },
  }
}

type SummaryKey = 'daily' | 'monthly' | 'annual'

export interface EnergyStore extends Readable<EnergyState> {
  set: Writable<EnergyState>['set']
  reset(): void
  loadRaw(before?: number, newer?: boolean): Promise<boolean>
  loadNewer(): Promise<boolean>
  loadDaily(): Promise<boolean>
  loadMonthly(): Promise<boolean>
  loadAnnual(): Promise<boolean>
}

function createEnergyStore(): EnergyStore {
  const P = writable<EnergyState>(emptyState())
  const { subscribe, update, set } = P

  function setLoading(key: keyof EnergyLoadingState, v: boolean): void {
    update((s) => ({ ...s, loading: { ...s.loading, [key]: v } }))
  }
  function setError(key: keyof EnergyLoadingState, v: boolean): void {
    update((s) => ({ ...s, error: { ...s.error, [key]: v } }))
  }

  // Both firmware backends (EnergyLogger and tsdb) answer /energy/raw?before=T
  // with the fixed window [T - 3h, T], so paging forward is just asking for the
  // window ending one step after the current anchor.
  const RAW_WINDOW_S = 3 * 3600

  async function loadRaw(before = 0, newer = false): Promise<boolean> {
    const url = before > 0 ? `/energy/raw?before=${before}` : '/energy/raw'
    setLoading('raw', true)
    setError('raw', false)
    const res: ApiResult<EnergyRaw | ErrorBody> = await serialQueue.add(() =>
      httpAPI<EnergyRaw | ErrorBody>('GET', url),
    )
    setLoading('raw', false)
    if (!res || res === 'error' || isErrorBody(res) || !Array.isArray(res.samples)) {
      setError('raw', true)
      return false
    }
    update((s) => {
      const historical = before > 0
      if (historical && res.samples.length === 0) {
        // Paging back into nothing means we hit the start of the data. Paging
        // forward into nothing is just a gap: keep what is shown but advance
        // the anchor so the next press keeps moving toward now.
        return newer
          ? { ...s, raw: { ...s.raw, before, noOlder: false } }
          : { ...s, raw: { ...s.raw, noOlder: true } }
      }
      return { ...s, raw: { samples: res.samples, historical, noOlder: false, before } }
    })
    return true
  }

  function loadNewer(): Promise<boolean> {
    const { before } = get(P).raw
    if (!before) return loadRaw()
    const next = before + RAW_WINDOW_S
    if (next >= Math.floor(Date.now() / 1000)) return loadRaw()
    return loadRaw(next, true)
  }

  async function loadSummary(
    key: SummaryKey,
    urlPath: string,
    fieldName: SummaryKey,
  ): Promise<boolean> {
    setLoading(key, true)
    setError(key, false)
    const res: ApiResult<Record<string, unknown>> = await serialQueue.add(() =>
      httpAPI<Record<string, unknown>>('GET', urlPath),
    )
    setLoading(key, false)
    if (!res || res === 'error' || res.msg === 'error' || !Array.isArray(res[fieldName])) {
      setError(key, true)
      return false
    }
    update((s) => ({ ...s, [key]: res[fieldName] }) as EnergyState)
    return true
  }

  return {
    subscribe,
    set,
    reset: () => set(emptyState()),
    loadRaw,
    loadNewer,
    loadDaily: () => loadSummary('daily', '/energy/daily', 'daily'),
    loadMonthly: () => loadSummary('monthly', '/energy/monthly', 'monthly'),
    loadAnnual: () => loadSummary('annual', '/energy/annual', 'annual'),
  }
}

export const energy_store = createEnergyStore()
