/**
 * The dashboard's status line: what the charger is doing and why, in one
 * place for every state. Pure — the caller supplies who holds the state claim,
 * the schedule plan and pre-formatted limit/boost text.
 */
import type { Plan } from '../api/device'
import type { DisplayState } from './state'
import type { ControlSegment } from './chargeMode'

export type StatusTone = 'charging' | 'success' | 'accent' | 'sleep' | 'dim' | 'error'

export interface I18nRef {
  key: string
  values?: Record<string, string>
}

export interface ChargerStatus {
  tone: StatusTone
  /** The charger state, in the glossary's words. */
  headline: I18nRef
  /** Whether a car is plugged in, where the state doesn't already say so. */
  plug: I18nRef | null
  /** Who or what decided this. */
  reason: I18nRef | null
  /** The actionable fact: when it changes, or what to do. */
  next: I18nRef | null
}

export interface ChargerStatusInput {
  display: DisplayState
  segment: ControlSegment
  /** EvseClients key of the client holding the state claim; '' when none. */
  stateOwner?: string
  vehicle?: boolean
  /** Raw EVSE state code, read on a fault. */
  fault?: number
  plan?: Plan | null
  /** The active charge limit, formatted ("80%"). */
  limitText?: string
  /** The active boost's target, formatted ("until 80%"). */
  boostText?: string
  /** Formats a device "HH:MM" for display. */
  time?: (hhmm: string) => string
  /** Display name for an EvseClients key. */
  clientName?: (key: string) => string
}

const P = 'dashboard.line.'

// Fault state codes → the suffix shared by the logs-states fault name and the
// dashboard's next-step text.
const FAULTS: Record<number, string> = {
  4: 'vent',
  5: 'diode',
  6: 'gfi',
  7: 'ground',
  8: 'relay',
  9: 'gfitest',
  10: 'temp',
  11: 'current',
}

const ref = (key: string, values?: Record<string, string>): I18nRef =>
  values ? { key: P + key, values } : { key: P + key }

export function chargerStatus(input: ChargerStatusInput): ChargerStatus {
  const {
    display,
    segment,
    stateOwner = '',
    vehicle = false,
    fault,
    plan,
    limitText = '',
    boostText = '',
    time = (t) => t,
    clientName = (k) => k,
  } = input
  // Plan events carry HH:MM:SS; schedules only resolve to the minute.
  const clock = (t: string) => time(t.slice(0, 5))
  // `false` (nothing scheduled) behaves like absent everywhere below.
  const cur = plan?.current_event || null
  const nextEvent = plan?.next_event || null
  const plug = ref(vehicle ? 'plug_in' : 'plug_out')
  const line = (
    tone: StatusTone,
    headline: string,
    reason: I18nRef | null,
    next: I18nRef | null = null,
    withPlug = false,
  ): ChargerStatus => ({ tone, headline: ref(headline), plug: withPlug ? plug : null, reason, next })

  switch (display) {
    case 'starting':
      return line('dim', 'starting', ref('why.starting'))
    case 'idle':
      return line('success', 'ready', ref('why.ready'))
    case 'connected':
      return line('accent', 'connected', ref('why.connected'))
    case 'off':
      return line('dim', 'off', ref('why.off'), ref('next.off'), true)
    case 'error': {
      const name = fault !== undefined ? FAULTS[fault] : undefined
      return line(
        'error',
        'fault',
        name ? { key: `logs-states.error-${name}` } : null,
        name ? ref(`fault_next.${name}`) : null,
        true,
      )
    }
    case 'charging': {
      // The next scheduled stop, when there is one.
      const until =
        nextEvent?.time && nextEvent.state !== 'active' ? ref('next.until', { time: clock(nextEvent.time) }) : null
      switch (stateOwner) {
        case 'manual':
          return line('charging', 'charging', ref('why.on'))
        case 'boost':
          return line('charging', 'charging', ref('why.boost', { target: boostText }))
        case 'timer':
          return line('charging', 'charging', ref('why.timer'), until)
        case 'divert':
          return line('charging', 'charging', ref('why.eco'))
        case 'rfid':
          return line('charging', 'charging', ref('why.rfid'))
        case 'ocpp':
          return line('charging', 'charging', ref('why.ocpp'))
        case '':
          return segment === 'eco'
            ? line('charging', 'charging', ref('why.eco'))
            : line('charging', 'charging', ref('why.auto'), until)
        default:
          return line('charging', 'charging', ref('why.client', { client: clientName(stateOwner) }))
      }
    }
    default: {
      // 'sleeping': a decision is withholding charging, so the charger is paused.
      const resumes =
        nextEvent?.time && nextEvent.state === 'active' ? ref('next.resumes', { time: clock(nextEvent.time) }) : null
      const paused = (reason: I18nRef, next: I18nRef | null = null) => line('sleep', 'paused', reason, next, true)
      switch (stateOwner) {
        case 'timer':
          return paused(cur?.time ? ref('why.timer_since', { since: clock(cur.time) }) : ref('why.timer_paused'), resumes)
        case 'divert':
          return paused(ref('why.eco_waiting'))
        case 'limit':
          return paused(ref('why.limit_reached', { value: limitText }), ref('next.limit'))
        case 'rfid':
          return paused(ref('why.rfid_waiting'), ref('next.rfid'))
        case 'ocpp':
          return paused(ref('why.ocpp'))
        case '':
        case 'manual':
          return resumes ? paused(ref('why.waiting'), resumes) : paused(ref('why.nothing'), ref('next.nothing'))
        default:
          return paused(ref('why.client', { client: clientName(stateOwner) }), resumes)
      }
    }
  }
}
