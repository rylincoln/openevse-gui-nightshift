import { persisted } from 'svelte-local-storage-store'
import type { Writable } from 'svelte/store'

export interface UiSettings {
  lang: string
  auto_release: boolean
  term_fontbig: boolean
  tz?: string
  mqtt_grid_ie?: string
  mqtt_solar?: string
  wizard_done: boolean
  /** local-only tariff in <currency> per kWh; 0 hides cost UI */
  energy_rate: number
  currency_symbol: string
  /** top of the Dashboard energy-limit slider, in kWh */
  max_energy_kwh: number
  /** gates power-user pages (Developer Tools) in Settings nav */
  dev_features: boolean
}

export interface UisettingsStore extends Writable<UiSettings> {}

export const uisettings_store: UisettingsStore = persisted('settings', {
  lang: 'en',
  auto_release: true,
  term_fontbig: false,
  tz: undefined,
  mqtt_grid_ie: undefined,
  mqtt_solar: undefined,
  wizard_done: false,
  energy_rate: 0,
  currency_symbol: '$',
  max_energy_kwh: 100,
  dev_features: false,
})
