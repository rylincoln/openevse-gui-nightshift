// Typed description of the OpenEVSE ESP32 firmware's HTTP + WebSocket API as
// this app uses it. Types only — import with `import type`.
//
// Rules: a field the firmware always sends is required. A field that exists
// only when a feature is present or configured is optional — an absent field
// means "this firmware predates the feature", and the UI gates on presence,
// never on value. Units live in the doc comment on the field.
//
// Field lists are derived from dev/fixtures/*.json plus every field the app
// reads; src/lib/api/device.check.ts asserts the fixtures still conform.

/** EVSE state from `/status.state`. 1 idle, 2 connected, 3 charging, 4–11 fault, 254 sleeping, 255 off. */
export type EvseState = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 254 | 255

/** Body of every successful POST/PATCH/DELETE. Anything other than 'done' / 'no change' is a device-side message. */
export interface WriteResponse {
  msg: 'done' | 'no change' | string
}

/** Error body some GETs return instead of a payload (`{ msg: 'error' }`). */
export interface ErrorBody {
  msg: string
}

/** The advisory badge carried inside `/status.notifications` and every WS frame that has it. */
export interface StatusNotifications {
  count: number
  severity: string
}

export interface Status {
  mode: string
  wifi_client_connected: number
  /** Absent on hardware with no Ethernet PHY. */
  eth_connected?: number
  net_connected: number
  ipaddress: string
  macaddress: string
  emoncms_connected: number
  packets_sent: number
  packets_success: number
  mqtt_connected: number
  mqtt_status: string
  mqtt_broker_ip: string
  mqtt_broker_version: string
  mqtt_connected_since: number
  mqtt_last_rx: number
  mqtt_error: string
  mqtt_error_detail: string
  /** Absent when OCPP is not built in / configured. */
  ocpp_connected?: number
  /** bytes */
  free_heap: number
  comm_sent: number
  comm_success: number
  rapi_connected: number
  evse_connected: number
  /** milliamps */
  amp: number
  /** volts */
  voltage: number
  /** watts */
  power: number
  /** amps */
  pilot: number
  /** amps */
  max_current: number
  /** tenths of °C */
  temp: number
  /** tenths of °C */
  temp_max: number
  /** tenths of °C; `false` when the probe is absent */
  temp1: number | false
  /** tenths of °C; `false` when the probe is absent */
  temp2: number | false
  /** tenths of °C; `false` when the probe is absent */
  temp3: number | false
  /** tenths of °C; `false` when the probe is absent. not in dev/fixtures — capability-gated (src/lib/monitoring/metrics.js) */
  temp4?: number | false
  state: EvseState
  status: string
  flags: number
  /** Absent on firmware without vehicle-data integration. */
  vehicle?: number
  colour: number
  manual_override: number
  /** bytes */
  freeram: number
  /** Absent on firmware without solar/divert mode. */
  divertmode?: number
  srssi: number
  time: string
  local_time: string
  offset: string
  /** seconds */
  uptime: number
  /** seconds */
  session_elapsed: number
  /** Wh */
  session_energy: number
  /** kWh */
  total_energy: number
  /** kWh */
  total_day: number
  /** kWh */
  total_week: number
  /** kWh */
  total_month: number
  /** kWh */
  total_year: number
  total_switches: number
  /** seconds */
  elapsed: number
  /** Wh */
  wattsec: number
  /** Wh */
  watthour: number
  gfcicount: number
  nogndcount: number
  stuckcount: number
  /** Absent on firmware without the advisory engine. Gate on presence, never on `count`. */
  notifications?: StatusNotifications
  /** Absent on firmware without solar/divert mode. */
  solar?: number
  grid_ie?: number
  /** amps */
  charge_rate?: number
  divert_update?: number
  divert_active?: boolean
  /** amps */
  smoothed_available_current?: number
  /** Absent on firmware without the current shaper. */
  shaper?: number
  shaper_live_pwr?: number
  shaper_cur?: number
  shaper_updated?: boolean
  service_level: number
  /** A limit is active. Absent on firmware predating the Limit feature — gate on presence, never on value. */
  limit?: boolean
  ota_update: number
  config_version: number
  claims_version: number
  override_version: number
  schedule_version: number
  schedule_plan_version: number
  limit_version: number
  /** Absent on firmware without vehicle-data integration. */
  vehicle_state_update?: number
  battery_level?: number
  battery_range?: number
  vehicle_charge_limit?: number
  time_to_full_charge?: number
  /** `false` when Tesla vehicle data is not (yet) available. */
  tesla_vehicle_count?: number | false
  tesla_vehicle_id?: string | false
  tesla_vehicle_name?: string | false
  /** Absent on firmware without home-battery integration. */
  home_battery_soc?: number
  home_battery_power?: number
  vehicle_charging_state?: string
  /** Absent on firmware predating the memory/health diagnostics. */
  heap_largest?: number
  heap_largest_min?: number
  heap_min?: number
  stack_loop_min?: number
  stack_events_min?: number
  ws_conns?: number
  ws_send_max?: number
  ws_reaped?: number
  lv_used_max?: number
  lv_frag_max?: number
  probe0_max?: number
  probe0_n?: number
  probe1_max?: number
  probe1_n?: number
  probe2_max?: number
  probe2_n?: number
  probe3_max?: number
  probe3_n?: number
  reset_reason?: number
  reset_reason_name?: string

  // The fields below are read by the app (src/lib/data/DataManager.svelte,
  // src/lib/dashboard/loadsharing.js, src/lib/monitoring/metrics.js,
  // src/routes/settings/{Terminal,Rfid}.svelte, src/routes/settings/Firmware.svelte,
  // src/lib/components/shell/AppShell.svelte, src/lib/components/wizard/steps/Wifi.svelte)
  // but absent from dev/fixtures/status.json — capability-gated.

  /** bytes. PSRAM boards only (ESP32-S3 LCD); Terminal.svelte gates its PSRAM rows on this being defined. */
  psram_free?: number
  /** bytes. PSRAM boards only. */
  psram_largest?: number
  /** hundredths of Hz. RAPI D9 ($GZ); src/lib/monitoring/metrics.js only renders the row when `> 0`. */
  frequency?: number
  /** Bumps on every /boost change. Absent on firmware without Boost. */
  boost_version?: number
  /** Bumps when GET /loadsharing/status should be re-fetched. */
  loadsharing_status_version?: number
  /** Bumps when GET /loadsharing/peers should be re-fetched. */
  loadsharing_peers_version?: number
  /** milliamps, amp-scaled like `amp`. */
  loadsharing_group_current_total?: number
  /** One entry per joined group member, this charger included. */
  loadsharing_joined_peers?: { hostname: string; name: string; amp: number; pilot: number }[]
  /** Device display name. */
  name?: string
  /** The wifi network currently joined, if any. */
  ssid?: string
  /** OTA update state machine, e.g. 'completed' / 'failed' while an update is running. */
  ota?: string
  /** OTA progress, 0–100. */
  ota_progress?: number
  /** 16MB flash-expansion migration state machine, e.g. 'done' / 'failed' while running. */
  migrate?: string
  /** Flash-expansion migration progress, 0–100. */
  migrate_progress?: number
  /** RFID reader present on the I2C bus, independent of RFID being enabled. */
  rfid_reader?: boolean
  /** Seconds remaining in an in-progress RFID scan countdown. */
  rfid_waiting?: number
  /** The tag just scanned at the reader, pending registration. */
  rfid_input?: string
  /** microSD card state machine: 'formatting' -> 'creating log' -> 'mounted'. */
  sd_status?: string
}

export interface Config {
  /** Absent on firmware without load sharing. */
  loadsharing_enabled?: boolean
  loadsharing_role?: string
  loadsharing_group_id?: string
  /** amps */
  loadsharing_group_max_current?: number
  loadsharing_safety_factor?: number
  mqtt_supported_protocols: string[]
  http_supported_protocols: string[]
  buildenv: string
  version: string
  wifi_serial: string
  protocol: string
  espinfo: string
  /** bytes */
  espflash: number
  firmware: string
  evse_serial: string
  diode_check: boolean
  gfci_check: boolean
  ground_check: boolean
  // Structurally identical to its 5 safety-toggle siblings above/below (same
  // ADVISORIES catalog entry, 'safety.relay_check') — not the later
  // relay-health-monitoring cluster the "relay_*" optional group means.
  relay_check: boolean
  vent_check: boolean
  // In dev/fixtures/config.json, but src/routes/settings/Safety.svelte only
  // includes this check when `$config_store?.temp_check !== undefined` —
  // a structural capability gate, so optional despite the fixture having it.
  temp_check?: boolean
  /** amps */
  max_current_soft: number
  service: number
  scale: number
  offset: number
  /** amps */
  min_current_hard: number
  /** amps */
  max_current_hard: number
  ssid: string
  pass: string
  ap_ssid: string
  ap_pass: string
  lang: string
  www_username: string
  www_password: string
  /** id of an uploaded certificate. Absent on firmware without TLS support. */
  www_certificate_id?: string
  hostname: string
  sntp_hostname: string
  time_zone: string
  limit_default_type: string
  limit_default_value: number
  emoncms_server: string
  emoncms_node: string
  emoncms_apikey: string
  emoncms_fingerprint: string
  mqtt_server: string
  mqtt_port: number
  mqtt_topic: string
  mqtt_user: string
  mqtt_pass: string
  /** id of an uploaded certificate. Absent on firmware without TLS support. */
  mqtt_certificate_id?: string
  mqtt_solar: string
  mqtt_grid_ie: string
  mqtt_vrms: string
  mqtt_live_pwr: string
  /** Absent on firmware without vehicle-data integration. */
  mqtt_vehicle_soc?: string
  mqtt_vehicle_range?: string
  mqtt_vehicle_eta?: string
  mqtt_vehicle_charge_limit?: string
  /** Absent on firmware without home-battery integration. */
  mqtt_home_battery_soc?: string
  mqtt_home_battery_power?: string
  mqtt_announce_topic: string
  /** Absent on firmware without OCPP. */
  ocpp_server?: string
  ocpp_chargeBoxId?: string
  ocpp_authkey?: string
  ocpp_idtag?: string
  ohm: string
  /** Absent on firmware without solar/divert mode. */
  divert_type?: number
  divert_PV_ratio?: number
  divert_attack_smoothing_time?: number
  divert_decay_smoothing_time?: number
  divert_min_charge_time?: number
  /** Absent on firmware without the current shaper. */
  current_shaper_max_pwr?: number
  current_shaper_smoothing_time?: number
  current_shaper_min_pause_time?: number
  current_shaper_data_maxinterval?: number
  vehicle_data_src: number
  /** Absent on firmware without Tesla integration. */
  tesla_access_token?: string
  tesla_refresh_token?: string
  tesla_created_at?: number
  tesla_expires_in?: number
  tesla_vehicle_id?: string
  rfid_storage: string
  scheduler_start_window: number
  flags: number
  flags_changed: number
  emoncms_enabled: boolean
  mqtt_enabled: boolean
  mqtt_reject_unauthorized: boolean
  mqtt_retained: boolean
  ohm_enabled: boolean
  sntp_enabled: boolean
  /** Absent on firmware without Tesla integration. */
  tesla_enabled?: boolean
  /** Absent on firmware without solar/divert mode. */
  divert_enabled?: boolean
  /** Absent on firmware without the current shaper. */
  current_shaper_enabled?: boolean
  pause_uses_disabled: boolean
  // button_enabled, is_threephase, default_state, voltage, relay_dc1,
  // relay_dc2, relay_ac, pp_auto, boot_lock, overcurrent_monitor: all in
  // dev/fixtures/config.json (so "always sent" by rule 1), but each is
  // gated by its own `{#if $config_store?.X !== undefined}` in
  // src/routes/settings/Evse.svelte / Safety.svelte / ChargeManager.svelte /
  // src/lib/components/wizard/steps/EvseBasics.svelte — the same
  // presence-gate idiom the spec uses for known capability-gated fields.
  // Treated as optional on that evidence rather than the letter of rule 2,
  // which does not name them.
  button_enabled?: boolean
  /** Absent on firmware without vehicle-data integration. */
  mqtt_vehicle_range_miles?: boolean
  /** Absent on firmware without OCPP. */
  ocpp_enabled?: boolean
  ocpp_auth_auto?: boolean
  ocpp_auth_offline?: boolean
  ocpp_suspend_evse?: boolean
  ocpp_energize_plug?: boolean
  rfid_enabled: boolean
  factory_write_lock: boolean
  is_threephase?: boolean
  wizard_passed: boolean
  default_state?: boolean
  mqtt_protocol: string
  charge_mode: string
  /** hundredths of a volt (divide by 100 for V) — src/routes/settings/Evse.svelte divides by 100 before display. Different unit than `Status.voltage`. */
  voltage?: number
  relay_dc1?: boolean
  relay_dc2?: boolean
  relay_ac?: boolean
  pp_auto?: boolean
  boot_lock?: boolean
  /** Absent on firmware without the security heartbeat. */
  heartbeat_interval?: number
  /** amps */
  heartbeat_current?: number
  over_temp_shutdown?: number
  /** Absent on firmware without the temperature throttle. */
  temp_throttle_enabled?: boolean
  temp_throttle_setpoint?: number
  overcurrent_monitor?: boolean
  /** Absent on firmware without zero-cross detection. */
  zero_cross?: boolean
  // RAPI D9 ($GI, commit 2cc1d2d "OpenEVSE9 Changes") — same feature class
  // as voltage/relay_dc*/pp_auto/boot_lock/zero_cross/heartbeat_* above,
  // which this file already marks optional. Pre-D9 firmware omits it;
  // About.svelte:22 gates its row on `{#if $config_store?.chip_id}`.
  chip_id?: string
  zero_cross_threshold_ma?: number
  /** Relay-health-monitoring cluster. Absent on firmware without relay diagnostics. */
  relay_life_pct?: number
  relay_cold_open_count?: number
  relay_elec_damage_x1e6?: number
  relay_transit_drift_warning?: boolean
  relay_transit_baseline_ms?: number
  relay_thermal_warning_level?: number
  relay_thermal_index_x100?: number
  relay_thermal_baseline_x100?: number
  relay_stuck_recovery_count?: number

  // The fields below are read by the app (src/routes/settings/{Mqtt,Evse,
  // Http,Terminal,Safety,LoadSharing}.svelte) but absent from
  // dev/fixtures/config.json — capability-gated.

  /** Cable-temperature monitoring toggle. */
  cable_temp?: boolean
  mqtt_sys_query?: boolean
  /** 0–255 */
  led_brightness?: number
  /** 'c' | 'f'. */
  temp_unit?: string
  www_http_enabled?: boolean
  www_https_enabled?: boolean
  www_https_port?: number
  /** bytes. App (OTA) partition size. */
  app0_size?: number
  /** bytes. Flashed sketch size. */
  sketch_size?: number
  /** Whether the gateway can migrate a 4MB flash layout to 16MB. */
  can_expand_16mb?: boolean
  /** bytes */
  littlefs_size?: number
  /** bytes */
  littlefs_used?: number
  /** bytes. Present only while a microSD card is mounted. */
  sd_size?: number
  /** bytes */
  sd_used?: number
  /** bytes. Fixed-size energy-log ring on the microSD card. */
  sd_log_size?: number
  chip_model?: string
  /** major*100+minor */
  chip_rev?: number
  chip_cores?: number
  /** bytes */
  psram_size?: number
  loadsharing_controller_host?: string
  loadsharing_failsafe_mode?: string
  /** amps */
  loadsharing_failsafe_safe_current?: number
  /** amps */
  loadsharing_failsafe_peer_assumed_current?: number
  /** seconds */
  loadsharing_heartbeat_timeout?: number
  /** seconds */
  loadsharing_rotation_interval?: number
}

export type LimitType = 'none' | 'time' | 'energy' | 'soc' | 'range'

/** `GET /limit`. `auto_release: false` ⇒ system (config-driven) limit. */
export interface Limit {
  type: LimitType
  value: number
  auto_release: boolean
}

/** `GET /override`. The device answers `{ msg: 'No manual override' }` when none is set; the store maps that to `{}`. */
export interface Override {
  state?: 'active' | 'disabled' | string
  charge_current?: number
  max_current?: number
  auto_release?: boolean
}

export interface ScheduleEvent {
  id: number
  state: string
  /** "HH:MM:SS" */
  time: string
  days: string[]
}

/** `GET /schedule/plan`. Event fields are `false` when no event is scheduled. */
export interface Plan {
  current_day: string
  current_offset: number
  next_event_delay: number | false
  current_event: ScheduleEvent | false
  next_event: ScheduleEvent | false
}

export interface Claim {
  client: number
  priority: number
  state: string
  charge_current: number
  auto_release: boolean
}

export interface ClaimsTarget {
  properties: { state: string; charge_current: number; auto_release: boolean }
  claims: { state: number; charge_current: number }
}

export interface Certificate {
  id: string
  name: string
  type: string
  certificate?: string
}

export interface Notification {
  id: string
  /** 'safety' | 'fault' | 'thermal' | 'wear', per src/lib/notifications/notifications.js's ADVISORIES catalog. */
  category: string
  severity: string
  sticky: boolean
  acked: boolean
  /** unix seconds; `0` means the clock had not synced when this was recorded — render as unknown, not 1970. */
  first_seen: number
  /** unix seconds */
  last_seen: number
}

export interface Notifications {
  count: number
  max_severity: string
  notifications: Notification[]
}

/** `GET /boost`. Idle is `{}` from the device; the store normalises it to `{ type: 'none', value: 0 }`. */
export interface Boost {
  type: LimitType
  value: number
  remaining?: number
  started?: number
}

export interface EnergySample {
  /** unix seconds */
  ts: number
  /** amps */
  a: number
  /** tenths of °C */
  t: number
  /** Wh */
  e: number
  s: EvseState
}
export interface EnergyRaw { samples: EnergySample[] }
export interface EnergyDaily { daily: { dt: string; pk: number; mn: number; en: number }[] }
export interface EnergyMonthly { monthly: { mo: string; pk: number; mn: number; en: number }[] }
export interface EnergyAnnual { annual: { yr: number; pk: number; mn: number; en: number }[] }

/** `GET /rfid/users`: tag → display name. */
export type RfidUsers = Record<string, string>

export interface LogEntry {
  time: string
  type: string
  evseState: EvseState
  /** Wh */
  energy: number
  /** tenths of °C */
  temperature: number
  /** Absent on legacy entries and on rows with no RFID tap. */
  rfidTag?: string
  /** amps. Read via src/lib/history/logs.js's logPilotAmps(). */
  pilot?: number
  /** An advisory id, when this row exists to name an advisory. */
  notification?: string
  /** Which fields changed since the previous entry, e.g. 'flags' | 'pilot' | 'divert' | 'shaper' | 'manager' | 'boot' | 'periodic'. */
  changed?: string[]
  /** OpenEVSE library OPENEVSE_VFLAG_* bitmask. */
  evseFlags?: number
  divertMode?: number
  shaper?: number
  /** 'active' | 'disabled', the charge-manager state at this entry. */
  managerState?: string
}

export interface CableTempSource {
  source: number
  name: string
  pin: number
  status: number
  r25: number
  beta: number
  offset_c10: number
  panic_c10: number
  /** °C (not tenths, unlike temp1–4). Present only while `status` indicates a valid reading. */
  temperature?: number
}
export interface CableTemp {
  supported: boolean
  enabled: boolean
  sources: CableTempSource[]
}

export interface LoadSharingPeer {
  id: string
  name: string
  host: string
  online: boolean
  joined: boolean
  priority: number
  /** Not in the mock/fixtures. src/lib/dashboard/loadsharing.js:74 falls back to this alongside `host`. */
  hostname?: string
  /** seconds, same clock as `Status.uptime`. src/lib/dashboard/loadsharing.js:76. */
  last_seen?: number
  /** Not in the mock/fixtures. Fallback for `host` at src/routes/settings/LoadSharing.svelte:387. */
  ip?: string
  /** Not in the mock/fixtures. src/routes/settings/LoadSharing.svelte:388. */
  isLocal?: boolean
  /** Not in the mock/fixtures. Preferred over `http://${host}` at src/routes/settings/LoadSharing.svelte:439. */
  url?: string
  /** Not in the mock/fixtures. src/routes/settings/LoadSharing.svelte:117-118. */
  status?: { state?: EvseState }
}
/** `GET /loadsharing/status`. */
export interface LoadSharingStatus {
  enabled: boolean
  group_id: string
  /** unix seconds */
  computed_at: number
  failsafe_active: boolean
  online_count: number
  offline_count: number
  peers: LoadSharingPeer[]
  allocations: { id: string; target_current: number; reason: string }[]
}
