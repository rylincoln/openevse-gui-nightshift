// Compile-time only. Nothing imports this file; svelte-check checks it because
// tsconfig `include` covers src/**/*.ts. It asserts that every mock fixture
// conforms to the device contract in ./device, so the hand-written types and
// the mock data cannot drift apart. Because an imported JSON is not a fresh
// object literal, `satisfies` checks that every required field is present
// with the right type; it does not flag extra fixture fields.
//
// JSON imports also widen literals (3 → number, false → boolean), so the
// fixtures are checked against the contract with every literal widened to its
// primitive. Structure and required/optional-ness are still enforced.
import type {
  Status, Config, Override, Plan, Claim, ClaimsTarget, Certificate,
  Notifications, CableTemp, RfidUsers, LogEntry, ScheduleEvent,
  EnergyRaw, EnergyDaily, EnergyMonthly, EnergyAnnual,
} from './device'

import status from '../../../dev/fixtures/status.json'
import config from '../../../dev/fixtures/config.json'
import override from '../../../dev/fixtures/override.json'
import plan from '../../../dev/fixtures/plan.json'
import claims from '../../../dev/fixtures/claims.json'
import claimsTarget from '../../../dev/fixtures/claims_target.json'
import certificates from '../../../dev/fixtures/certificates.json'
import notifications from '../../../dev/fixtures/notifications.json'
import cabletemp from '../../../dev/fixtures/cabletemp.json'
import rfidUsers from '../../../dev/fixtures/rfid_users.json'
import logs from '../../../dev/fixtures/logs.json'
import schedule from '../../../dev/fixtures/schedule.json'
import energyRaw from '../../../dev/fixtures/energy_raw.json'
import energyDaily from '../../../dev/fixtures/energy_daily.json'
import energyMonthly from '../../../dev/fixtures/energy_monthly.json'
import energyAnnual from '../../../dev/fixtures/energy_annual.json'

type Widen<T> = T extends number ? number
  : T extends string ? string
  : T extends boolean ? boolean
  : T extends (infer U)[] ? Widen<U>[]
  : T extends object ? { [K in keyof T]: Widen<T[K]> }
  : T

status satisfies Widen<Status>
config satisfies Widen<Config>
override satisfies Widen<Override>
plan satisfies Widen<Plan>
claims satisfies Widen<Claim[]>
claimsTarget satisfies Widen<ClaimsTarget>
certificates satisfies Widen<Certificate[]>
notifications satisfies Widen<Notifications>
cabletemp satisfies Widen<CableTemp>
rfidUsers satisfies Widen<RfidUsers>
logs satisfies Widen<LogEntry[]>
schedule satisfies Widen<ScheduleEvent[]>
energyRaw satisfies Widen<EnergyRaw>
energyDaily satisfies Widen<EnergyDaily>
energyMonthly satisfies Widen<EnergyMonthly>
energyAnnual satisfies Widen<EnergyAnnual>
