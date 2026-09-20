/** Pure helpers for the Monitoring screen. Self-contained — no store/DOM imports. */
import { formatTemp } from '../temperature'
import { EvseClients } from '../vars'
import { cableTempStatusKey } from '../cabletemp'
import type { Status, EvseState, CableTemp } from '../api/device'
import type { ConfigState } from '../stores/config'
import type { ClaimsTargetModel } from '../stores/claims_target'

/** Claim priority for an EVSE client id (higher wins); 0 if unknown. */
function clientPriority(id: unknown): number {
  for (const key of Object.keys(EvseClients)) {
    if (EvseClients[key].id === id) return EvseClients[key].priority
  }
  return 0
}

/**
 * OpenEVSE state code → charging-status label. Derived from the EVSE's own
 * state machine, so it works without any vehicle integration. Only the
 * car-connected states carry a meaningful charging status:
 *   3 = charging (delivering current), 2 = connected but idle.
 * Other states (no car, fault, sleeping/disabled) have no charging status and
 * are surfaced elsewhere (Dashboard / Safety tab), so the row is omitted.
 */
const CHARGING_STATE_BY_EVSE: Partial<Record<EvseState, string>> = {
  2: 'monitoring.vehicle.charging_idle',
  3: 'monitoring.vehicle.charging_active',
}

/** One labelled value in a MetricGroupModel; what MetricRow.svelte receives. */
export interface MetricRowModel {
  labelKey: string
  value?: number | string | null
  unit?: string
  textKey?: string
}

/** A titled group of rows; what MetricGroup.svelte / MetricsTab.svelte receive. */
export interface MetricGroupModel {
  titleKey: string
  rows: MetricRowModel[]
}

/** Round `value` to `p` decimals; null for missing / non-numeric input. */
export function round(value: unknown, p: number = 0): number | null {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  const m = Math.pow(10, p)
  return Math.round(n * m) / m
}

/** Format a duration in seconds as HH:MM:SS. */
function hms(sec: number | undefined): string {
  const s = Number(sec)
  if (!Number.isFinite(s) || s < 0) return '00:00:00'
  const pad = (n: number) => String(Math.floor(n)).padStart(2, '0')
  return `${pad(s / 3600)}:${pad((s % 3600) / 60)}:${pad(s % 60)}`
}

/** Tenths-of-°C → °C (1 dp); null when the sensor reports no real number. */
function tempC(raw: number | false | undefined): number | null {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null
  return round(raw / 10, 1)
}

export function energyMetrics(status: Status | undefined): MetricGroupModel {
  const s: Partial<Status> = status ?? {}
  return {
    titleKey: 'monitoring.group.energy',
    rows: [
      { labelKey: 'monitoring.energy.session', value: round((s.session_energy ?? 0) / 1000, 1), unit: 'units.kwh' },
      { labelKey: 'monitoring.energy.total', value: round(s.total_energy, 1), unit: 'units.kwh' },
      { labelKey: 'monitoring.energy.day', value: round(s.total_day, 1), unit: 'units.kwh' },
      { labelKey: 'monitoring.energy.week', value: round(s.total_week, 1), unit: 'units.kwh' },
      { labelKey: 'monitoring.energy.month', value: round(s.total_month, 1), unit: 'units.kwh' },
      { labelKey: 'monitoring.energy.year', value: round(s.total_year, 1), unit: 'units.kwh' },
    ],
  }
}

export function sensorMetrics(
  status: Status | undefined,
  config: ConfigState | undefined,
  { tempUnit = 'c' }: { tempUnit?: string } = {},
): MetricGroupModel {
  const s: Partial<Status> = status ?? {}
  const c: Partial<ConfigState> = config ?? {}
  const evseT = formatTemp(tempC(s.temp), tempUnit)
  const rows: MetricRowModel[] = [
    { labelKey: 'monitoring.sensor.pilot', value: round(s.pilot, 0), unit: 'units.amp' },
    { labelKey: 'monitoring.sensor.current', value: round((s.amp ?? 0) / 1000, 1), unit: 'units.amp' },
    { labelKey: 'monitoring.sensor.voltage', value: round(s.voltage, 0), unit: 'units.volt' },
  ]
  // AC frequency only exists on D9+ firmware ($GZ). Add the row only when the
  // device reports it — null values render as "—", so an unconditional push
  // would leave a permanent empty frequency row on every older device.
  if (s.frequency != null && s.frequency > 0) {
    rows.push({ labelKey: 'monitoring.sensor.frequency', value: round(s.frequency / 100, 2), unit: 'units.hz' })
  }
  rows.push({ labelKey: 'monitoring.sensor.evsetemp', value: evseT.value, unit: evseT.unitKey })
  ;[s.temp1, s.temp2, s.temp3, s.temp4].forEach((raw, i) => {
    const v = tempC(raw)
    if (v === null) return
    const t = formatTemp(v, tempUnit)
    rows.push({ labelKey: `monitoring.sensor.temp${i + 1}`, value: t.value, unit: t.unitKey })
  })
  rows.push({ labelKey: 'monitoring.sensor.scale', value: c.scale ?? null, unit: '' })
  rows.push({ labelKey: 'monitoring.sensor.offset', value: c.offset ?? null, unit: '' })
  return { titleKey: 'monitoring.group.sensors', rows }
}

export function serviceMetrics(status: Status | undefined, config: ConfigState | undefined): MetricGroupModel {
  const s: Partial<Status> = status ?? {}
  const c: Partial<ConfigState> = config ?? {}
  return {
    titleKey: 'monitoring.group.service',
    rows: [
      { labelKey: 'monitoring.service.level', value: s.service_level ?? null, unit: '' },
      { labelKey: 'monitoring.service.min', value: c.min_current_hard ?? null, unit: 'units.amp' },
      { labelKey: 'monitoring.service.max', value: c.max_current_soft ?? null, unit: 'units.amp' },
    ],
  }
}

export function vehicleMetrics(status: Status | undefined, config: ConfigState | undefined): MetricGroupModel {
  const s: Partial<Status> = status ?? {}
  const c: Partial<ConfigState> = config ?? {}
  const rows: MetricRowModel[] = [
    { labelKey: 'monitoring.vehicle.updated', value: hms(s.vehicle_state_update), unit: '' },
    { labelKey: 'monitoring.vehicle.battery', value: s.battery_level ?? null, unit: 'units.percent' },
    {
      labelKey: 'monitoring.vehicle.range',
      value: s.battery_range ?? null,
      unit: c.mqtt_vehicle_range_miles ? 'units.miles' : 'units.km',
    },
    { labelKey: 'monitoring.vehicle.timeleft', value: hms(s.time_to_full_charge), unit: '' },
  ]
  const chargingKey = typeof s.state === 'number' ? CHARGING_STATE_BY_EVSE[s.state] : undefined
  if (chargingKey) {
    rows.push({ labelKey: 'monitoring.vehicle.charging_state', textKey: chargingKey, unit: '' })
  }
  return { titleKey: 'monitoring.group.vehicle', rows }
}

/** Whether the Vehicle metric group should render. */
export function showVehicle(status: Status | undefined, _config: ConfigState | undefined): boolean {
  const s: Partial<Status> = status ?? {}
  // time_to_full_charge lives on /status (device.ts), same as vehicleMetrics above.
  return s.battery_level !== undefined || s.battery_range !== undefined || !!s.time_to_full_charge
}

export function homeBatteryMetrics(status: Status | undefined): MetricGroupModel {
  const s: Partial<Status> = status ?? {}
  return {
    titleKey: 'monitoring.group.home_battery',
    rows: [
      { labelKey: 'monitoring.home_battery.soc', value: round(s.home_battery_soc, 0), unit: 'units.percent' },
      { labelKey: 'monitoring.home_battery.power', value: round(s.home_battery_power, 0), unit: 'units.watt' },
    ],
  }
}

/** Whether the Home Battery group should render. */
export function showHomeBattery(status: Status | undefined): boolean {
  const s: Partial<Status> = status ?? {}
  return round(s.home_battery_soc, 0) !== null
}

/**
 * Cable Temperature Monitoring readings, from GET /cabletemp — one row per
 * *assigned* source (unassigned sources have nothing to show and are
 * omitted, not just blanked, same convention as sensorMetrics' temp1-4).
 * Labels reuse the Safety page's `config.cabletemp.source_*` keys rather
 * than duplicating them under `monitoring.*`.
 */
export function cableTempMetrics(cabletemp: CableTemp | undefined, tempUnit: string = 'c'): MetricGroupModel {
  const c: Partial<CableTemp> = cabletemp ?? {}
  const sources = c.sources ?? []
  const rows: MetricRowModel[] = sources
    .filter((s) => s.pin)
    .map((s) => {
      const statusKey = cableTempStatusKey(s.status)
      if (statusKey) {
        return { labelKey: `config.cabletemp.source_${s.name}`, textKey: `config.cabletemp.status_${statusKey}`, unit: '' }
      }
      const t = formatTemp(s.temperature, tempUnit)
      return { labelKey: `config.cabletemp.source_${s.name}`, value: t.value, unit: t.unitKey }
    })
  return { titleKey: 'monitoring.group.cable_temp', rows }
}

/** Whether the Cable Temperature group should render (at least one source assigned to a pin). */
export function showCableTemp(cabletemp: CableTemp | undefined): boolean {
  return !!(cabletemp?.sources ?? []).some((s) => s.pin)
}

/** 'ok' | 'warning' | 'error' for a count against warning / alert thresholds. */
export function countSeverity(count: number, warning: number, alert: number): 'ok' | 'warning' | 'error' {
  const n = Number(count)
  if (!Number.isFinite(n)) return 'ok'
  if (n > alert) return 'error'
  if (n > warning) return 'warning'
  return 'ok'
}

/** One Safety-tab row. The fault row carries `state` for getStateDesc. */
export interface SafetyRow {
  key: string
  count?: number
  state?: EvseState
  severity: 'ok' | 'warning' | 'error'
}

export interface SafetyData {
  errors: SafetyRow[]
  infos: SafetyRow[]
}

/** Build the Safety-tab rows. The fault row carries `state` for getStateDesc. */
export function safetyData(status: Status | undefined, hasError: boolean): SafetyData {
  const s: Partial<Status> = status ?? {}
  const countRow = (key: string, count: number | undefined): SafetyRow => ({
    key,
    count: count ?? 0,
    severity: (count ?? 0) === 0 ? 'ok' : 'error',
  })
  const errors: SafetyRow[] = []
  if (hasError) errors.push({ key: 'fault', state: s.state, severity: 'error' })
  errors.push(countRow('gfci', s.gfcicount))
  errors.push(countRow('noground', s.nogndcount))
  errors.push(countRow('stuck', s.stuckcount))
  const switches = s.total_switches ?? 0
  const infos: SafetyRow[] = [{ key: 'switches', count: switches, severity: countSeverity(switches, 20000, 40000) }]
  return { errors, infos }
}

/** One relay-health row for the Health tab. */
export interface RelayHealthRow {
  key: string
  value: number | boolean | null
  severity: 'ok' | 'warning' | 'error'
}

/**
 * Relay contact-life health rows for the Health tab, from $GL (surfaced via
 * /config's config_serialize()). Returns null when the controller doesn't
 * support RELAY_HEALTH (relay_life_pct absent), so the whole section can be
 * hidden rather than showing a wall of dashes. Values needing translation
 * (severity → OK/Watch/Warning, ms/% suffixes, "not available") are resolved
 * in the component, not here — this module stays store/DOM/i18n-free.
 */
export function relayHealthData(config: ConfigState | undefined): RelayHealthRow[] | null {
  const c: Partial<ConfigState> = config ?? {}
  if (c.relay_life_pct === undefined) return null

  const lifePct = round(c.relay_life_pct, 0) ?? 0
  const lifeSeverity: 'ok' | 'warning' | 'error' = lifePct <= 20 ? 'error' : lifePct <= 50 ? 'warning' : 'ok'
  const thermalLevel = c.relay_thermal_warning_level ?? 0
  const thermalSeverity: 'ok' | 'warning' | 'error' = thermalLevel >= 2 ? 'error' : thermalLevel >= 1 ? 'warning' : 'ok'
  const transitDrift = !!c.relay_transit_drift_warning
  const stuckRecoveryCount = c.relay_stuck_recovery_count ?? 0

  return [
    { key: 'life_pct', value: lifePct, severity: lifeSeverity },
    { key: 'cold_open_count', value: c.relay_cold_open_count ?? 0, severity: 'ok' },
    { key: 'elec_damage', value: round((c.relay_elec_damage_x1e6 ?? 0) / 10000, 2), severity: 'ok' },
    { key: 'transit_drift', value: transitDrift, severity: transitDrift ? 'warning' : 'ok' },
    { key: 'transit_baseline', value: c.relay_transit_baseline_ms !== undefined ? c.relay_transit_baseline_ms : null, severity: 'ok' },
    { key: 'thermal_warning', value: thermalLevel, severity: thermalSeverity },
    { key: 'thermal_index', value: c.relay_thermal_index_x100 !== undefined ? round(c.relay_thermal_index_x100 / 100, 2) : null, severity: 'ok' },
    { key: 'thermal_baseline', value: c.relay_thermal_baseline_x100 !== undefined ? round(c.relay_thermal_baseline_x100 / 100, 2) : null, severity: 'ok' },
    { key: 'stuck_recovery_count', value: stuckRecoveryCount, severity: stuckRecoveryCount > 0 ? 'warning' : 'ok' },
  ]
}

/** One row in the Charge Manager's claims table. */
export interface ClaimRow {
  property: string
  clientId: number | null | undefined
  value: unknown
  priority: number
}

/**
 * One row per entry in `claims_target.claims`, sorted highest priority first.
 * `priorityByClient` (client id → actual runtime priority, from /claims) is
 * preferred when available; otherwise the client's default priority is used.
 */
export function claimRows(
  claimsTarget: ClaimsTargetModel | undefined,
  priorityByClient: Record<number, number> | null = null,
): ClaimRow[] {
  const ct: ClaimsTargetModel = claimsTarget ?? {}
  // The wire object's keys are dynamic property names (whatever the device
  // claims), not a fixed shape, so index generically rather than widening
  // the stores/claims_target.ts interfaces.
  const claims = (ct.claims ?? {}) as Record<string, number | null | undefined>
  const properties = (ct.properties ?? {}) as Record<string, unknown>
  return Object.keys(claims)
    .map((property) => {
      const clientId = claims[property]
      const priority =
        typeof clientId === 'number' && priorityByClient && priorityByClient[clientId] != null
          ? priorityByClient[clientId]
          : clientPriority(clientId)
      return { property, clientId, value: properties[property], priority }
    })
    .sort((a, b) => b.priority - a.priority)
}
