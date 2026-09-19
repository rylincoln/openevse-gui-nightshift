// src/lib/config/divert.ts
// Solar-divert tuning presets. Each preset fixes the same four divert
// parameters; "custom" means the live config matches none of them.
import type { Config } from '../api/device'

export interface DivertPreset {
  id: string
  divert_attack_smoothing_time: number
  divert_decay_smoothing_time: number
  divert_min_charge_time: number
  divert_PV_ratio: number
}

export type DivertPresetValues = Omit<DivertPreset, 'id'>

export const DIVERT_PRESETS: DivertPreset[] = [
  { id: 'default',   divert_attack_smoothing_time: 20,  divert_decay_smoothing_time: 600, divert_min_charge_time: 600, divert_PV_ratio: 1.1 },
  { id: 'no_waste',  divert_attack_smoothing_time: 20,  divert_decay_smoothing_time: 600, divert_min_charge_time: 600, divert_PV_ratio: 0.5 },
  { id: 'no_import', divert_attack_smoothing_time: 300, divert_decay_smoothing_time: 20,  divert_min_charge_time: 600, divert_PV_ratio: 1.1 },
]

const FIELDS: (keyof DivertPresetValues)[] = [
  'divert_attack_smoothing_time',
  'divert_decay_smoothing_time',
  'divert_min_charge_time',
  'divert_PV_ratio',
]

export function presetValues(id: string): DivertPresetValues | null {
  const p = DIVERT_PRESETS.find((x) => x.id === id)
  if (!p) return null
  return {
    divert_attack_smoothing_time: p.divert_attack_smoothing_time,
    divert_decay_smoothing_time: p.divert_decay_smoothing_time,
    divert_min_charge_time: p.divert_min_charge_time,
    divert_PV_ratio: p.divert_PV_ratio,
  }
}

export function matchPreset(config: Partial<Config> | undefined | null): string {
  if (!config) return 'custom'
  for (const p of DIVERT_PRESETS) {
    if (FIELDS.every((f) => Number(config[f]) === p[f])) return p.id
  }
  return 'custom'
}
