import { describe, it, expect } from 'vitest'
import { chargerStatus } from '../status'

const base = { segment: 'auto', stateOwner: '', vehicle: false, plan: null }

// The keys alone, so each case reads as "what the line says" at a glance.
const keys = (s) => ({
  tone: s.tone,
  headline: s.headline.key.replace('dashboard.line.', ''),
  plug: s.plug ? s.plug.key.replace('dashboard.line.', '') : null,
  reason: s.reason ? s.reason.key.replace('dashboard.line.', '') : null,
  next: s.next ? s.next.key.replace('dashboard.line.', '') : null,
})

const plan = (cur, next) => ({
  current_day: 'mon',
  current_offset: 0,
  next_event_delay: 0,
  current_event: cur ? { id: 1, state: cur.state, time: cur.time, days: [] } : false,
  next_event: next ? { id: 2, state: next.state, time: next.time, days: [] } : false,
})

describe('chargerStatus', () => {
  it('says the charger is starting', () => {
    expect(keys(chargerStatus({ ...base, display: 'starting' }))).toEqual({
      tone: 'dim', headline: 'starting', plug: null, reason: 'why.starting', next: null,
    })
  })

  it('tells a ready charger to plug in', () => {
    expect(keys(chargerStatus({ ...base, display: 'idle' }))).toEqual({
      tone: 'success', headline: 'ready', plug: null, reason: 'why.ready', next: null,
    })
  })

  // State 2: the charger is offering power and the car is choosing not to
  // draw it. That is not a pause, so it must not read as one.
  it('puts a connected car that is not drawing power down to the car', () => {
    expect(keys(chargerStatus({ ...base, display: 'connected', vehicle: true }))).toEqual({
      tone: 'accent', headline: 'connected', plug: null, reason: 'why.connected', next: null,
    })
  })

  describe('while charging, says who is driving it', () => {
    const charging = { ...base, display: 'charging', vehicle: true }

    it('Auto with nothing else deciding', () => {
      expect(keys(chargerStatus(charging))).toEqual({
        tone: 'charging', headline: 'charging', plug: null, reason: 'why.auto', next: null,
      })
    })
    it('On, the owner\'s manual override', () => {
      expect(keys(chargerStatus({ ...charging, segment: 'on', stateOwner: 'manual' })).reason).toBe('why.on')
    })
    it('Eco, solar divert', () => {
      expect(keys(chargerStatus({ ...charging, segment: 'eco', stateOwner: 'divert' })).reason).toBe('why.eco')
    })
    it('Eco before divert has claimed anything', () => {
      expect(keys(chargerStatus({ ...charging, segment: 'eco' })).reason).toBe('why.eco')
    })
    it('Boost, with its target', () => {
      const s = chargerStatus({ ...charging, stateOwner: 'boost', boostText: 'until 80%' })
      expect(s.reason).toEqual({ key: 'dashboard.line.why.boost', values: { target: 'until 80%' } })
    })
    it('a scheduled rule, and when it stops', () => {
      const s = chargerStatus({
        ...charging,
        stateOwner: 'timer',
        plan: plan({ state: 'active', time: '22:00:00' }, { state: 'disabled', time: '07:00:00' }),
      })
      expect(keys(s).reason).toBe('why.timer')
      expect(s.next).toEqual({ key: 'dashboard.line.next.until', values: { time: '07:00' } })
    })
    it('Auto, with the next scheduled stop', () => {
      const s = chargerStatus({ ...charging, plan: plan(null, { state: 'disabled', time: '07:00:00' }) })
      expect(keys(s)).toMatchObject({ reason: 'why.auto', next: 'next.until' })
    })
    it('does not promise a stop when the next event allows charging', () => {
      const s = chargerStatus({ ...charging, plan: plan(null, { state: 'active', time: '07:00:00' }) })
      expect(s.next).toBeNull()
    })
    it('RFID and OCPP', () => {
      expect(keys(chargerStatus({ ...charging, stateOwner: 'rfid' })).reason).toBe('why.rfid')
      expect(keys(chargerStatus({ ...charging, stateOwner: 'ocpp' })).reason).toBe('why.ocpp')
    })
    it('any other client, by name', () => {
      const s = chargerStatus({ ...charging, stateOwner: 'mqtt', clientName: (k) => `<${k}>` })
      expect(s.reason).toEqual({ key: 'dashboard.line.why.client', values: { client: '<mqtt>' } })
    })
  })

  describe('while paused, says what is holding charging and when it resumes', () => {
    const paused = { ...base, display: 'sleeping', vehicle: true }

    it('a scheduled rule, since when and until when', () => {
      const s = chargerStatus({
        ...paused,
        stateOwner: 'timer',
        plan: plan({ state: 'disabled', time: '07:00:00' }, { state: 'active', time: '23:00:00' }),
      })
      expect(keys(s)).toEqual({
        tone: 'sleep', headline: 'paused', plug: 'plug_in', reason: 'why.timer_since', next: 'next.resumes',
      })
      expect(s.reason.values).toEqual({ since: '07:00' })
      expect(s.next.values).toEqual({ time: '23:00' })
    })
    it('a scheduled rule the plan has no start time for', () => {
      const s = chargerStatus({
        ...paused, stateOwner: 'timer', plan: plan(null, { state: 'active', time: '23:00:00' }),
      })
      expect(keys(s)).toMatchObject({ reason: 'why.timer_paused', next: 'next.resumes' })
    })
    it('Eco waiting for surplus', () => {
      expect(keys(chargerStatus({ ...paused, segment: 'eco', stateOwner: 'divert' }))).toMatchObject({
        reason: 'why.eco_waiting', next: null,
      })
    })
    it('a reached charge limit, and how to charge past it', () => {
      const s = chargerStatus({ ...paused, stateOwner: 'limit', limitText: '80%' })
      expect(s.reason).toEqual({ key: 'dashboard.line.why.limit_reached', values: { value: '80%' } })
      expect(keys(s).next).toBe('next.limit')
    })
    it('RFID waiting for a card', () => {
      expect(keys(chargerStatus({ ...paused, stateOwner: 'rfid' }))).toMatchObject({
        reason: 'why.rfid_waiting', next: 'next.rfid',
      })
    })
    it('OCPP and other clients', () => {
      expect(keys(chargerStatus({ ...paused, stateOwner: 'ocpp' })).reason).toBe('why.ocpp')
      expect(keys(chargerStatus({ ...paused, stateOwner: 'evcc' })).reason).toBe('why.client')
    })
    it('nothing claiming, with a scheduled start', () => {
      const s = chargerStatus({ ...paused, plan: plan(null, { state: 'active', time: '23:00:00' }) })
      expect(keys(s)).toMatchObject({ reason: 'why.waiting', next: 'next.resumes' })
    })
    it('nothing claiming and nothing scheduled: says how to start', () => {
      expect(keys(chargerStatus(paused))).toMatchObject({ reason: 'why.nothing', next: 'next.nothing' })
    })
    it('says whether a car is plugged in', () => {
      expect(keys(chargerStatus({ ...paused, vehicle: false })).plug).toBe('plug_out')
    })
  })

  it('says Off is the owner\'s choice and how to undo it', () => {
    expect(keys(chargerStatus({ ...base, display: 'off', segment: 'off', vehicle: true }))).toEqual({
      tone: 'dim', headline: 'off', plug: 'plug_in', reason: 'why.off', next: 'next.off',
    })
  })

  describe('on a fault, names it and gives a next step', () => {
    it('GFCI fault', () => {
      const s = chargerStatus({ ...base, display: 'error', fault: 6, vehicle: true })
      expect(s.tone).toBe('error')
      expect(s.headline.key).toBe('dashboard.line.fault')
      expect(s.plug.key).toBe('dashboard.line.plug_in')
      expect(s.reason.key).toBe('logs-states.error-gfi')
      expect(s.next.key).toBe('dashboard.line.fault_next.gfi')
    })
    it('every fault code has its own next step', () => {
      const steps = [4, 5, 6, 7, 8, 9, 10, 11].map(
        (fault) => chargerStatus({ ...base, display: 'error', fault }).next?.key,
      )
      expect(steps.every(Boolean)).toBe(true)
      expect(new Set(steps).size).toBe(8)
    })
  })

  it('formats every clock time with the given formatter', () => {
    const s = chargerStatus({
      ...base,
      display: 'sleeping',
      stateOwner: 'timer',
      plan: plan({ state: 'disabled', time: '07:00:00' }, { state: 'active', time: '23:00:00' }),
      time: (hhmm) => `[${hhmm}]`,
    })
    expect(s.reason.values).toEqual({ since: '[07:00]' })
    expect(s.next.values).toEqual({ time: '[23:00]' })
  })
})
