import { writable, derived, get, type Writable } from 'svelte/store'
import type { WifiNetwork } from '../config/wifi'

export interface AlertBox {
  title?: string
  body?: string
  visible: boolean
  button: boolean
  closable: boolean
  component?: unknown
  action: () => void
}

export interface UiStates {
  // copy from other stores
  charge_current?: number
  shaper?: number
  autorelease: boolean
  time_lmt: number
  charge_lmt: number
  // Bumped by WebSocket.svelte whenever a frame carries the notifications
  // object. The firmware sends it on connect, when the live set changes
  // and on every ack, so each arrival is a reason to re-read the list —
  // even when count and severity happen to land on the same pair.
  notification_event: number
  logidx_min: number
  logidx_max: number
  charging: boolean
  time_localestring: string | null
  error: boolean
  error_desc: string
  // local states
  data_loaded: boolean
  ws_connected: boolean
  ws_last_seen: number // unix secs of last successful WS contact; 0 = never
  ws_retry_request: number // nonce; bump to force an immediate WS reconnect
  ws_debug: {
    // diagnostics surfaced in the disconnect overlay's details panel
    attempts: number // reconnect attempts since the last successful open
    ever_connected: boolean // did the socket ever reach OPEN this session
    close_code: number | null // last CloseEvent.code (1006 = abnormal, no frame)
    close_reason: string // last CloseEvent.reason (usually empty)
    retry_delay_ms: number // backoff before the pending retry
  }
  status_expanded: boolean
  breakpoint?: string
  wizard_step: number
  // undefined on a charger without the matching capability (vehicle-data
  // integration, solar/divert mode, an RFID reader) — the source /status
  // fields are optional, and DataManager copies them through as-is.
  vehicle_state_update: number | undefined
  divert_update: number | undefined
  rfid_waiting: number | undefined
  elapsed: number | undefined
  alertbox: AlertBox
  networks: WifiNetwork[]
}

const model: UiStates = {
  charge_current: undefined,
  shaper: undefined,
  autorelease: true,
  time_lmt: 0,
  charge_lmt: 0,
  notification_event: 0,
  logidx_min: 0,
  logidx_max: 0,
  charging: false,
  time_localestring: null,
  error: false,
  error_desc: '',
  data_loaded: false,
  ws_connected: true,
  ws_last_seen: 0,
  ws_retry_request: 0,
  ws_debug: {
    attempts: 0,
    ever_connected: false,
    close_code: null,
    close_reason: '',
    retry_delay_ms: 0,
  },
  status_expanded: false,
  breakpoint: undefined,
  wizard_step: 0,
  vehicle_state_update: 0,
  divert_update: 0,
  rfid_waiting: 0,
  elapsed: 0,
  alertbox: {
    title: undefined,
    body: undefined,
    visible: false,
    button: false,
    closable: true,
    component: undefined,
    action: () => {},
  },
  networks: [],
}

export interface UiStatesStore extends Writable<UiStates> {
  resetAlertBox(): void
  setObject<K extends keyof UiStates>(obj: K, data: UiStates[K]): void
}

function createUIStatesStore(): UiStatesStore {
  const P = writable<UiStates>(model)
  const { subscribe, set, update } = P

  function resetAlertBox(): void {
    const states = get(P)
    states.alertbox = {
      title: undefined,
      body: undefined,
      visible: false,
      button: false,
      closable: true,
      component: undefined,
      action: () => {},
    }
    P.update(() => states)
  }
  function setObject<K extends keyof UiStates>(obj: K, data: UiStates[K]): void {
    // write nested object
    const states = get(P)
    states[obj] = data
    P.update(() => states)
  }

  return {
    subscribe,
    set,
    resetAlertBox,
    setObject,
    update,
  }
}

export const uistates_store = createUIStatesStore()
