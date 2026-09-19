# TypeScript Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert every `src/lib/**` module and every component to TypeScript under `strict: true`, with a typed description of the device API and a `svelte-check` gate in CI — with no runtime or visible behaviour change.

**Architecture:** `tsconfig.json` runs `strict: true` with `checkJs: false` from the first commit, so svelte-check reports only converted files and the gate is green at every step. Conversion goes bottom-up: contract types → `api/` and `stores/` → the rest of `src/lib` → components by directory → routes. Import specifiers are rewritten from `'./x.js'` to `'./x'` by a codemod as files rename; tests stay JavaScript and are excluded from the check.

**Tech Stack:** Svelte 5 (runes), Vite 8, Vitest, TypeScript 6, svelte-check 4, pnpm 12.

**Spec:** `docs/superpowers/specs/2026-09-19-typescript-migration-design.md`

## Global Constraints

- **pnpm only.** `pnpm add -D …`, `pnpm test`, `pnpm build`. Never npm/npx/yarn.
- **TypeScript `~6`.** Not 7. svelte-check 4.7 refuses TS 7 without `--tsgo`.
- **`strict: true` from Task 1.** Never loosen a flag to make a file pass.
- **No runtime behaviour change.** Same conditions, same values, same store contents. `httpAPI` keeps returning the string `'error'`. Stores keep their initial values. `P.update(() => res)` stays `P.update(() => res)`.
- **No explicit `any` in app code.** `unknown` + narrowing. `// @ts-expect-error <reason>` only for third-party typing gaps; never `@ts-ignore`.
- **A type error that exposes a real bug** is fixed in its own commit, with a test, *before* the conversion commit that would otherwise hide it.
- **Tests stay `.js`** and stay in place. Only their import/`vi.mock()` specifiers change (via the codemod).
- **Node-side code stays JavaScript**: `dev/`, `scripts/`, `vite.config.js`, `vitest.config.js`, `svelte.config.js`.
- **Import specifiers:** extensionless for `.ts` modules (`'../stores/config'`, `'../config/configForm.svelte'` for the rune module `configForm.svelte.ts`); `.svelte` and `.json` keep their extensions.
- **Commit messages:** conventional prefixes as in `git log` (`chore:`, `refactor:`, `docs:`, `ci:`). No AI attribution of any kind.
- **Baseline to preserve:** `Test Files 144 passed (144)`, `Tests 1156 passed (1156)` — becomes 144 / 1157 after the one bug-fix test in Task 5.

## The gate

Run after every task, before committing. All three must pass; from Task 7 onward the fourth too.

```bash
pnpm check                                  # → "0 errors" (warnings must be 0 too from Task 17)
pnpm test 2>&1 | grep -E "Test Files|Tests " # → 144 passed (144) / 1156 passed (1156); 1157 from Task 5 on
pnpm build                                  # → exits 0
# From Task 7 on:
pnpm screenshots && git status --porcelain docs/screenshots   # → prints nothing
```

Extension check, from Task 7 on — the only `.js` specifiers left must point at files that are still `.js`:

```bash
grep -rnoE "['\"]\.{1,2}/[^'\"]+\.js['\"]" src | grep -v __tests__ | while IFS=: read f l spec; do
  t=$(dirname "$f")/$(echo "$spec" | tr -d "'\"")
  [ -f "$t" ] || echo "DANGLING $f:$l $spec"
done
```

Expected output: nothing.

---

## Phase 1 — Tooling

### Task 1: Type-check tooling and CI gate

**Files:**
- Create: `tsconfig.json` (rename from `jsconfig.json`)
- Delete: `jsconfig.json`
- Create: `src/global.d.ts`
- Modify: `svelte.config.js`
- Modify: `package.json` (devDependencies, `scripts.check`)
- Modify: `vitest.config.js:28` (coverage include)
- Modify: `.github/workflows/test.yml` (`test` job, after "Install dependencies")

**Interfaces:**
- Produces: `pnpm check` — the gate every later task runs. The ambient module `promise-batching-queue` typed as `PromiseBatcher.newSerialQueue(): SerialQueue` with `queue<T>(fn: () => T | Promise<T>): Promise<T>` (Task 7's `queue.ts` relies on it). `__APP_VERSION__: string` (Task 16's `About.svelte`/`Firmware.svelte` rely on it).

- [ ] **Step 1: Record the baseline**

Run: `pnpm test 2>&1 | grep -E "Test Files|Tests "`
Expected: `Test Files  144 passed (144)` and `Tests  1156 passed (1156)`. If the numbers differ, stop — the baseline in Global Constraints is wrong and must be corrected first.

- [ ] **Step 2: Add the dev dependencies**

Run: `pnpm add -D 'typescript@~6' svelte-check @types/luxon`
Expected: `package.json` devDependencies gain the three entries; `pnpm-lock.yaml` updates. Verify: `pnpm exec tsc --version` prints `Version 6.x`.

- [ ] **Step 3: Replace `jsconfig.json` with `tsconfig.json`**

Run: `git mv jsconfig.json tsconfig.json`, then overwrite `tsconfig.json` with:

```jsonc
{
  "compilerOptions": {
    "moduleResolution": "bundler",
    "target": "ESNext",
    "module": "ESNext",
    // svelte-preprocess cannot tell a value import from a type import, so
    // types must be imported with `import type`.
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "sourceMap": true,
    "esModuleInterop": true,
    "types": ["vite/client"],
    "skipLibCheck": true,
    // Vite/esbuild transpile; the checker never emits.
    "noEmit": true,
    // Strict from day one. checkJs stays off so unconverted .js files are
    // parsed for inference but never reported — the gate is green at every
    // commit and each file is checked strictly the moment it becomes .ts.
    "strict": true,
    "allowJs": true,
    "checkJs": false
  },
  "include": ["src/**/*.ts", "src/**/*.js", "src/**/*.svelte", "src/**/*.d.ts"],
  // Tests stay JavaScript and are not type-checked.
  "exclude": ["src/**/__tests__/**", "src/test-setup.js"]
}
```

- [ ] **Step 4: Enable the TypeScript preprocessor**

Overwrite `svelte.config.js`:

```js
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

/** @type {import("@sveltejs/vite-plugin-svelte").SvelteConfig} */
export default {
  // Required for <script lang="ts"> in components.
  preprocess: vitePreprocess(),
}
```

- [ ] **Step 5: Add the ambient declarations**

Create `src/global.d.ts`:

```ts
// Ambient declarations for things the checker cannot see on its own.

// Injected at build time by vite.config.js `define`; read by the About and
// Firmware settings pages.
declare const __APP_VERSION__: string

// promise-batching-queue ships no types and has no @types package. This is
// exactly the surface src/lib/queue uses, nothing more.
declare module 'promise-batching-queue' {
  export interface SerialQueue {
    queue<T>(fn: () => T | Promise<T>): Promise<T>
  }
  export const PromiseBatcher: {
    newSerialQueue(): SerialQueue
  }
}
```

- [ ] **Step 6: Add the `check` script and fix coverage scope**

In `package.json` `scripts`, after `"test:coverage"`, add:

```json
"check": "svelte-check --tsconfig ./tsconfig.json",
```

In `vitest.config.js` line 28 change `include: ['src/lib/**/*.js']` to:

```js
include: ['src/lib/**/*.{js,ts}'],
```

- [ ] **Step 7: Run the check — expect green on the untouched tree**

Run: `pnpm check`
Expected: last line `svelte-check found 0 errors and 0 warnings` (a small number of warnings is acceptable only if they are about the tsconfig itself; investigate anything in `src/`).

- [ ] **Step 8: Prove the gate bites**

Create `src/lib/__gate_probe.ts` containing exactly:

```ts
export const n: number = 'not a number'
```

Run: `pnpm check; echo "exit=$?"`
Expected: `1 error` reported at `src/lib/__gate_probe.ts:1`, `exit=1`.

Then: `rm src/lib/__gate_probe.ts && pnpm check` → `0 errors`.

- [ ] **Step 9: Add the CI step**

In `.github/workflows/test.yml`, in the `test` job, insert immediately after the `Install dependencies` step (before `Run tests with coverage`):

```yaml
      - name: Type check
        run: pnpm check
```

Match the indentation of the neighbouring steps exactly.

- [ ] **Step 10: Run the gate**

Run: `pnpm check && pnpm test 2>&1 | grep -E "Test Files|Tests " && pnpm build`
Expected: 0 errors; 144/1156; build exits 0.

- [ ] **Step 11: Commit**

```bash
git add tsconfig.json jsconfig.json src/global.d.ts svelte.config.js package.json pnpm-lock.yaml vitest.config.js .github/workflows/test.yml
git commit -m "chore: add svelte-check type gate (strict, checkJs off)"
```

---

## Phase 2 — The device contract, `api/`, `stores/`

### Task 2: `src/lib/api/device.ts` — typed device payloads

**Files:**
- Create: `src/lib/api/device.ts`

**Interfaces:**
- Produces (all `export`ed, types only): `EvseState`, `WriteResponse`, `ErrorBody`, `Status`, `StatusNotifications`, `Config`, `Override`, `Limit`, `LimitType`, `ScheduleEvent`, `Plan`, `Claim`, `ClaimsTarget`, `Certificate`, `Notifications`, `Notification`, `Boost`, `EnergySample`, `EnergyRaw`, `EnergyDaily`, `EnergyMonthly`, `EnergyAnnual`, `RfidUsers`, `LogEntry`, `CableTemp`, `CableTempSource`, `LoadSharingStatus`, `LoadSharingPeer`.
- Consumed by Tasks 3–6 and every component task.

- [ ] **Step 1: Generate the raw field lists from the fixtures**

Run, and keep the output in a scratch file — it is the starting point for `Status` and `Config`:

```bash
for f in status config; do
  echo "--- $f"
  node -e '
    const j = require("./dev/fixtures/'"$f"'.json")
    for (const [k, v] of Object.entries(j))
      console.log(`  ${k}: ${Array.isArray(v) ? "unknown[]" : v === null ? "null" : typeof v}`)
  '
done
```

- [ ] **Step 2: Collect every `/status` and `/config` field the app reads**

```bash
git ls-files 'src/**/*.svelte' 'src/lib/**/*.js' | grep -v __tests__ \
  | xargs grep -ohE '\$status_store\??\.[a-z_0-9]+|\$s\??\.[a-z_0-9]+' | sed -E 's/^[^.]*\.//' | sort -u
git ls-files 'src/**/*.svelte' 'src/lib/**/*.js' | grep -v __tests__ \
  | xargs grep -ohE '\$config_store\??\.[a-z_0-9A-Z]+|\bc\??\.[a-z_0-9A-Z]+' | sed -E 's/^[^.]*\.//' | sort -u
```

Any field in these lists that is **not** in the fixture is either (a) a capability-gated field → add it to the interface as optional with the comment `// not in dev/fixtures — capability-gated`, or (b) a field read from another object that the regex caught by accident → ignore. Known genuine (a) cases from `/status`: `boost_version`, `temp4`, `loadsharing_status_version`, `loadsharing_peers_version`, `loadsharing_group_current_total`, `loadsharing_joined_peers`, `ota_progress`, `rfid_input`, `sd_status`.

- [ ] **Step 3: Write the file**

Create `src/lib/api/device.ts`. The fixed parts are below verbatim; `Status` and `Config` are completed from Steps 1–2 by these rules:

1. Every fixture key becomes a member with the fixture's primitive type.
2. **Required** if the firmware always sends it. **Optional (`?`)** if it appears only when a feature is present or configured: every `*_version` except `config_version`/`claims_version`/`override_version`/`schedule_version`/`schedule_plan_version`/`limit_version`; `limit`; `notifications`; the vehicle group (`vehicle`, `vehicle_state_update`, `battery_level`, `battery_range`, `vehicle_charge_limit`, `time_to_full_charge`, `vehicle_charging_state`, `tesla_*`); `home_battery_*`; the divert/solar group (`solar`, `grid_ie`, `charge_rate`, `divert_update`, `divert_active`, `smoothed_available_current`, `divertmode`); the shaper group (`shaper*`); `ocpp_connected`; `eth_connected`; heap/stack/probe diagnostics (`heap_*`, `stack_*`, `probe*`, `ws_*`, `lv_*`, `reset_reason*`); in `Config`, every `loadsharing_*`, `relay_*`, `mqtt_vehicle_*`, `mqtt_home_battery_*`, `tesla_*`, `ocpp_*`, `current_shaper_*`, `divert_*`, `temp_throttle_*`, `over_temp_shutdown`, `zero_cross*`, `heartbeat_*`, `www_certificate_id`, `mqtt_certificate_id`.
3. Sensor fields the firmware sends as `false` when the probe is absent are `number | false`: `temp1`, `temp2`, `temp3`, `temp4?`. Same shape for `tesla_vehicle_count?: number | false`, `tesla_vehicle_id?: string | false`, `tesla_vehicle_name?: string | false`.
4. `state: EvseState` (not `number`).
5. Units go in a doc comment on the field, copied from the "Device facts" section of `CLAUDE.md`: `amp` milliamps; `power` watts; `session_energy`, `watthour`, `wattsec` Wh; `total_energy`, `total_day`, `total_week`, `total_month`, `total_year` kWh; `temp`, `temp_max`, `temp1`–`temp4` tenths of °C; `voltage` volts; `pilot`, `max_current`, `charge_rate`, `smoothed_available_current` amps; `uptime`, `session_elapsed`, `elapsed` seconds; `free_heap`, `freeram` bytes.

```ts
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
  // ← completed from dev/fixtures/status.json per rules 1–5 above.
  //   Keep the fixture's key order. Examples of the required shape:
  /** milliamps */
  amp: number
  /** watts */
  power: number
  state: EvseState
  /** tenths of °C; `false` when the probe is absent */
  temp1: number | false
  config_version: number
  /** Bumps on every /boost change. Absent on firmware without Boost. */
  boost_version?: number
  notifications?: StatusNotifications
  // … every other fixture key …
}

export interface Config {
  // ← completed from dev/fixtures/config.json per rules 1–2 and 5 above.
  //   Keep the fixture's key order.
  firmware: string
  max_current_soft: number
  wizard_passed: boolean
  loadsharing_role?: string
  // … every other fixture key …
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
  severity: string
  code: string
  // ← complete from dev/fixtures/scenarios/notifications.json and what
  //   src/lib/notifications/notifications.js reads.
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
  rfidTag: string
  // ← add any further fields src/lib/history/logs.js reads.
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
}
export interface LoadSharingStatus {
  // ← complete from the `/api/loadsharing/status` handler in dev/mock-plugin.js
  //   and what src/lib/stores/loadsharing.js and src/lib/dashboard/loadsharing.js read.
  [key: string]: unknown
}
```

Every `// ←` comment must be resolved before the commit — the file contains no arrow comments when done. `LoadSharingStatus`'s index signature is a placeholder to be replaced by the real fields.

- [ ] **Step 4: Run the gate**

Run: `pnpm check` → 0 errors. (A types-only file cannot break tests or the build, but run `pnpm test 2>&1 | grep -E "Test Files|Tests "` anyway → 144/1156.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/api/device.ts
git commit -m "refactor: add typed description of the device API"
```

### Task 3: `device.check.ts` — fixtures must conform to the contract

**Files:**
- Create: `src/lib/api/device.check.ts`

**Interfaces:**
- Consumes: every interface from Task 2.
- Produces: nothing importable. Exists to be type-checked.

- [ ] **Step 1: Write the check file**

```ts
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
```

- [ ] **Step 2: Run the check and reconcile**

Run: `pnpm check`
Expected: a handful of errors on first run. `Widen` already absorbs JSON literal widening, so every remaining error is a real field/optionality disagreement between a fixture and the contract. Resolve each by the spec rule: if the app relies on the field, fix `device.ts`; if the app reads a field the fixture lacks, add it to the fixture (mock mode must cover every call the app makes). Never widen a type in `device.ts` just to make a fixture pass.

Re-run until `pnpm check` → 0 errors.

- [ ] **Step 3: Prove the check bites**

Temporarily change `count: number` in `Notifications` to `count: string`, run `pnpm check` → 1 error in `device.check.ts`. Revert. `pnpm check` → 0 errors.

- [ ] **Step 4: Run the gate and commit**

```bash
pnpm check && pnpm test 2>&1 | grep -E "Test Files|Tests " && pnpm build
git add src/lib/api/device.ts src/lib/api/device.check.ts dev/fixtures
git commit -m "refactor: assert mock fixtures conform to the device contract"
```

### Task 4: `httpAPI.ts`

**Files:**
- Rename: `src/lib/api/httpAPI.js` → `src/lib/api/httpAPI.ts`
- Modify: `src/lib/api/__tests__/httpAPI.test.js` (import specifier only)

**Interfaces:**
- Produces: `httpAPI<T = unknown>(method: string, url: string, body?: string | null, type?: 'json' | 'text', timeout?: number): Promise<ApiResult<T>>`; `type ApiResult<T> = T | 'error'`; `isErrorBody(x: unknown): x is ErrorBody`. Every store (Tasks 5–6) consumes these.

- [ ] **Step 1: Rename**

Run: `git mv src/lib/api/httpAPI.js src/lib/api/httpAPI.ts`

- [ ] **Step 2: Type the module**

Overwrite `src/lib/api/httpAPI.ts` (body logic identical to the JS; only annotations added):

```ts
import { get } from 'svelte/store'
import { uistates_store } from '../stores/uistates.js'
import { redirect } from '../router.js'
import type { ErrorBody } from './device'

/** Every call resolves to the payload or the string 'error' — never rejects. */
export type ApiResult<T> = T | 'error'

/** True for a `{ msg: 'error' }` body, which some GETs return instead of a payload. */
export function isErrorBody(x: unknown): x is ErrorBody {
  return typeof x === 'object' && x !== null && 'msg' in x && (x as ErrorBody).msg === 'error'
}

export async function httpAPI<T = unknown>(
  method: string,
  url: string,
  body: string | null = null,
  type: 'json' | 'text' = 'json',
  timeout = 60000,
): Promise<ApiResult<T>> {
  const content_type =
    type === 'json'
      ? 'application/json'
      : 'application/x-www-form-urlencoded; charset=UTF-8'
  const controller = new AbortController()
  const data: RequestInit = {
    method,
    signal: controller.signal,
    // X-Requested-With is required by the firmware CSRF guard on cookie-authed
    // mutations; a cross-origin form cannot set it. Harmless on GETs.
    headers: { 'Content-Type': content_type, 'X-Requested-With': 'OpenEVSE' },
  }
  if (body) data.body = body
  // do not timeout on the first request, in case authentication is needed
  if (get(uistates_store).has_fetched) {
    setTimeout(() => controller.abort(), timeout)
  }
  if (import.meta.env.DEV) {
    if (!url.includes('http', 0)) url = '/api' + url
  }
  const res: ApiResult<T> = await fetch(url, data)
    .then((response): Promise<T> | 'error' => {
      // Session expired / not logged in: send the user to the login page.
      // Login.svelte posts to /login with a bare fetch (not httpAPI), so this
      // interceptor never fires during the login request itself.
      if (response.status === 401) {
        redirect('/login')
        return 'error'
      }
      return (type === 'json' ? response.json() : response.text()) as Promise<T>
    })
    .catch((error: unknown) => {
      console.log(error)
      return 'error' as const
    })
  uistates_store.update((x) => {
    x.has_fetched = true
    return x
  })
  return res
}
```

The two imports keep their `.js` extensions because `uistates.js` and `router.js` are still JavaScript at this point; the codemod in Task 7 strips them when those files convert.

- [ ] **Step 3: Fix the test's import**

In `src/lib/api/__tests__/httpAPI.test.js`, change every `'../httpAPI.js'` (imports and `vi.mock` targets) to `'../httpAPI'`.

- [ ] **Step 4: Run the gate**

`pnpm check` → 0 errors. `pnpm test src/lib/api` → passes. Full gate → 144/1156, build OK.

- [ ] **Step 5: Commit**

```bash
git add -A src/lib/api
git commit -m "refactor: convert httpAPI to TypeScript with a typed result"
```

### Task 5: Stores I — `status`, `config`, `limit`, `boost`, `override`

**Files:**
- Create: `src/lib/stores/deviceStore.ts`
- Rename + type: `src/lib/stores/{status,config,limit,boost,override}.js` → `.ts`
- Modify: their tests' import specifiers in `src/lib/stores/__tests__/{status,config,limit,boost,override}.test.js` and any other test that `vi.mock`s these paths (find with `grep -rln "stores/\(status\|config\|limit\|boost\|override\)\.js" src`)

**Interfaces:**
- Produces:
  - `DeviceStore<T>`: `Writable<T | undefined> & { download(): Promise<boolean> }`
  - `status_store: DeviceStore<Status>`
  - `ConfigState = Config & { firmware_is_eu: boolean; max_current_firmware: 32 | 80 }`; `config_store: Writable<ConfigState | undefined> & { download(): Promise<boolean>; upload(data: Partial<Config>): Promise<boolean>; saveParam<K extends keyof Config>(name: K, val: Config[K]): Promise<boolean> }`
  - `limit_store: Writable<Limit> & { download(): Promise<boolean>; upload(data: Partial<Limit>): Promise<boolean>; remove(id?: unknown): Promise<boolean>; reset(): boolean }`
  - `boost_store: Writable<Boost> & { download(): Promise<boolean>; upload(data: Partial<Boost>): Promise<ApiResult<WriteResponse>>; remove(): Promise<boolean>; reset(): boolean }`
  - `override_store: Writable<Override | undefined> & { get: typeof get; download(): Promise<boolean>; upload(data: Override): Promise<boolean>; clear(): Promise<boolean>; toggle(): Promise<boolean>; removeProp(prop: keyof Override): Promise<boolean> }`

- [ ] **Step 1: Create the shared store interface**

`src/lib/stores/deviceStore.ts`:

```ts
import type { Writable } from 'svelte/store'

/**
 * The common shape of a store that mirrors one device resource: a writable
 * (undefined until the first successful download) plus `download()`, which
 * resolves true when the store now holds fresh data. Stores with writes add
 * their own `upload`/`remove`/… on top.
 */
export interface DeviceStore<T> extends Writable<T | undefined> {
  download(): Promise<boolean>
}
```

- [ ] **Step 2: Convert `status`**

`git mv src/lib/stores/status.js src/lib/stores/status.ts`, then:

```ts
import { writable } from 'svelte/store'
import { httpAPI, isErrorBody } from '../api/httpAPI'
import type { Status } from '../api/device'
import type { DeviceStore } from './deviceStore'

function createStatusStore(): DeviceStore<Status> {
  const P = writable<Status | undefined>()
  const { subscribe, set, update } = P

  async function download(): Promise<boolean> {
    const res = await httpAPI<Status>('GET', '/status')
    if (res && res !== 'error' && !isErrorBody(res)) {
      P.update(() => res)
      return true
    } else {
      return false
    }
  }
  return {
    subscribe,
    set,
    update,
    download,
  }
}

export const status_store = createStatusStore()
```

The condition `res && res.msg != "error" && res != "error"` became `res && res !== 'error' && !isErrorBody(res)` — same three tests, same order of short-circuiting.

- [ ] **Step 3: Convert `limit`**

`git mv src/lib/stores/limit.js src/lib/stores/limit.ts`, then:

```ts
import { writable, type Writable } from 'svelte/store'
import { httpAPI } from '../api/httpAPI'
import type { Limit, WriteResponse } from '../api/device'

const model: Limit = {
  type: 'none',
  value: 0,
  auto_release: true,
}

export interface LimitStore extends Writable<Limit> {
  download(): Promise<boolean>
  upload(data: Partial<Limit>): Promise<boolean>
  remove(id?: unknown): Promise<boolean>
  reset(): boolean
}

function createLimitStore(): LimitStore {
  const P = writable<Limit>(model)
  const { subscribe, set, update } = P

  async function download(): Promise<boolean> {
    const res = await httpAPI<Limit | WriteResponse>('GET', '/limit')
    if (res && res !== 'error' && 'type' in res) {
      P.update(() => res)
      return true
    } else if (res && res !== 'error' && 'msg' in res && res.msg == 'no limit') {
      // reset limit to default
      P.update(() => model)
      return true
    } else return false
  }

  async function upload(data: Partial<Limit>): Promise<boolean> {
    const res = await httpAPI<WriteResponse>('POST', '/limit', JSON.stringify(data))
    if (res !== 'error' && res.msg == 'done') return true
    else return false
  }

  async function remove(_id?: unknown): Promise<boolean> {
    const res = await httpAPI<WriteResponse>('DELETE', '/limit')
    // "no limit" = nothing to delete — success for an idempotent remove
    if (res !== 'error' && (res.msg == 'done' || res.msg == 'no limit')) {
      P.update(() => model)
      return true
    } else return false
  }

  function reset(): boolean {
    P.update(() => model)
    return true
  }

  return { subscribe, set, update, download, reset, remove, upload }
}

export const limit_store = createLimitStore()
```

`res !== 'error' &&` guards are new in `upload`/`remove`. They are **not** a behaviour change: in JavaScript `('error').msg` is `undefined`, so the old comparison was already false — the guard only lets the type narrow.

**One real bug this task exposes — fix it first, in its own commit.** `override.js`'s `download()` tests `res?.msg == undefined`; when `httpAPI` resolves to the string `'error'`, `'error'.msg` is `undefined`, so the store is set to the string `'error'` and `download()` returns `true`. `override.test.js` has no case for it. Before renaming `override.js`:

1. Add to `src/lib/stores/__tests__/override.test.js`, next to the existing `'returns false and leaves the store unchanged when the upload request fails'` test:

```js
  it('download returns false and leaves the store unchanged when the request fails', async () => {
    override_store.set({ state: 'active', charge_current: 10 })
    httpAPI.mockResolvedValue('error')

    const result = await override_store.download()
    expect(result).toBe(false)
    expect(get(override_store)).toEqual({ state: 'active', charge_current: 10 })
  })
```

2. Run `pnpm test src/lib/stores/__tests__/override` → the new test FAILS (`result` is `true`, store is `'error'`).
3. In `override.js` change the first branch of `download()` to `if (res && res !== 'error' && res?.msg == undefined) {`.
4. Run the test → PASS. Full `pnpm test` → 144 files, **1157** tests.
5. `git add src/lib/stores/override.js src/lib/stores/__tests__/override.test.js && git commit -m "fix: override download must not store the error sentinel"`.

The baseline from here on is **144 / 1157**.

- [ ] **Step 4: Convert `config`**

`git mv src/lib/stores/config.js src/lib/stores/config.ts`. Keep every function; add:

```ts
import { writable, type Writable } from 'svelte/store'
import { httpAPI, isErrorBody } from '../api/httpAPI'
import type { Config, WriteResponse } from '../api/device'

/** `/config` plus the two flags this store derives from `firmware`. */
export interface ConfigState extends Config {
  firmware_is_eu: boolean
  /** EU firmware is capped at 32 A, otherwise 80 A. */
  max_current_firmware: 32 | 80
}

export interface ConfigStore extends Writable<ConfigState | undefined> {
  download(): Promise<boolean>
  upload(data: Partial<Config>): Promise<boolean>
  saveParam<K extends keyof Config>(name: K, val: Config[K]): Promise<boolean>
}
```

Signatures inside:
- `isEuropeanFirmware(fw: unknown): boolean`
- `withDerived(obj: Config): ConfigState` — the JS accepted anything and returned it unchanged when not an object; the only caller paths pass a `Config` (from download) or a `ConfigState` (from update), so type it `(obj: Config | ConfigState): ConfigState`. Keep the `obj && typeof obj === 'object'` guard's behaviour by returning `obj as ConfigState` in the else branch.
- `download` uses `httpAPI<Config>` and the same `res && res !== 'error' && !isErrorBody(res)` condition as `status`.
- `upload(data: Partial<Config>)`: `httpAPI<WriteResponse>` then `res !== 'error' && (res.msg == 'done' || res.msg == 'no change')`.
- `saveParam<K extends keyof Config>(name: K, val: Config[K])`: `const data = { [name]: val } as Partial<Config>`.
- `setWithDerived(value: ConfigState | undefined)`, `updateWithDerived(fn: (c: ConfigState | undefined) => ConfigState | undefined)` — `withDerived` is applied to the result when it is defined.
- Return type of `createConfigStore(): ConfigStore`.

- [ ] **Step 5: Convert `boost` and `override`**

`boost.ts`: `model: Boost = { type: 'none', value: 0 }`; `writable<Boost>(model)`; `download` uses `httpAPI<Boost | Record<string, never>>` and the same two branches (`'type' in res` → store it; `typeof res === 'object'` → model); `upload(data: Partial<Boost>): Promise<ApiResult<WriteResponse>>` returns the raw result (the JS comment explains why); `remove(): Promise<boolean>` keeps `res && res !== 'error' && (res.msg === 'done' || res.msg === 'no boost')`. Export `interface BoostStore extends Writable<Boost> { download; upload; remove; reset }`.

`override.ts`: `writable<Override | undefined>()`; `download` uses `httpAPI<Override | ErrorBody>`; the (already fixed) `res && res !== 'error' && res?.msg == undefined` branch becomes `res && res !== 'error' && !('msg' in res)`; the `'No manual override'` branch stores `{}` (typed `Override` — every field is optional, so `{}` is a valid `Override`); `upload(data: Override)`; `clear()`, `toggle()` (`res !== 'error' && res.msg === 'Updated'`); `removeProp(prop: keyof Override)` — `delete override[prop]` is legal on an optional key. Keep the `get: (s) => get(s)` member typed as `get: typeof get`.

- [ ] **Step 6: Fix test import specifiers**

```bash
grep -rln "stores/\(status\|config\|limit\|boost\|override\)\.js" src | xargs sed -i '' -E "s#(stores/(status|config|limit|boost|override))\.js#\1#g"
```

Then verify nothing dangles: `grep -rn "stores/\(status\|config\|limit\|boost\|override\)\.js" src` → nothing. App-code importers (`.svelte`, other `.js`) are also rewritten by this — that is intended; Vite resolves extensionless to `.ts`.

- [ ] **Step 7: Run the gate**

`pnpm check` → 0 errors. `pnpm test 2>&1 | grep -E "Test Files|Tests "` → 144 / 1157 (the Step 3 fix added one test; this is the baseline from now on). `pnpm build` → OK.

- [ ] **Step 8: Commit**

```bash
git add -A src
git commit -m "refactor: convert core device stores to TypeScript"
```

### Task 6: Stores II — the remaining fourteen

**Files:**
- Rename + type: `src/lib/stores/{cabletemp,certificates,claims,claims_target,energy,history,loadsharing,notifications,plan,rfid_users,schedule,theme,uisettings,uistates}.js` → `.ts`
- Modify: import specifiers across `src/` (tests and app) for these fourteen paths

**Interfaces:**
- Consumes: `httpAPI`, `isErrorBody`, `ApiResult` (Task 4); the payload types (Task 2); `DeviceStore` (Task 5).
- Produces (export names unchanged from the JS): `cabletemp_store`, `certificate_store`, `claims_store`, `claims_target_store`, `energy_store`, `history_store`, `loadsharing_store`, `notification_store`, `plan_store`, `rfid_users_store`, `schedule_store`, `theme_store`, `uisettings_store`, `uistates_store`, each with an exported `interface <Name>Store` describing its full surface, plus `UiStates` (the `uistates` model type) and `AlertBox` (its `alertbox` member).

- [ ] **Step 1: Convert each store, one `git mv` + edit at a time**

For each file: `git mv X.js X.ts`, then type it by this procedure —

1. Read the JS. Note the `writable(...)` initial value and every function in the returned object.
2. Pick the payload type from `device.ts` (`Claim[]`, `Certificate[]`, `ScheduleEvent[]`, `Plan`, `ClaimsTarget`, `Notifications`, `CableTemp`, `RfidUsers`, `LogEntry[]`, the `Energy*` set, `LoadSharingStatus`/`LoadSharingPeer[]`).
3. Declare `export interface <Name>Store extends Writable<T> { … }` where `T` is `Payload | undefined` when the initial value is `writable()` (plan, history) and the concrete type when it is seeded (`Certificate[]` for `writable([])`, the `model` type for `writable(model)`).
4. `writable<T>(initial)`; annotate every function's parameters and return type; replace `res.msg`/`res != 'error'` checks with `res !== 'error' && …` and `isErrorBody` exactly as in Task 5, preserving each store's own condition.
5. `createXStore(): <Name>Store`.

Store-specific notes:
- `uistates.ts`: the `model` object becomes `const model: UiStates = { … }` with `export interface UiStates` listing every key with its real type — `charge_current?: number`, `shaper?: number`, `notification_badge: string | null`, `mode?: 0 | 1 | 2`, `stateclaimfrom: string | null`, `ws_debug: { attempts: number; ever_connected: boolean; close_code: number | null; close_reason: string; retry_delay_ms: number }`, `alertbox: AlertBox`, `networks: unknown[]` (refine to the scan result shape if `src/lib/config/wifi.js` defines one), `breakpoint?: string`. `export interface AlertBox { title?: string; body?: string; visible: boolean; button: boolean; closable: boolean; component?: unknown; action: () => void }`. `setObject<K extends keyof UiStates>(obj: K, data: UiStates[K])`.
- `uisettings.ts`: wraps `svelte-local-storage-store`; type the settings object (`dev_features: boolean`, temperature unit, etc. — read the file for the full key list).
- `theme.ts`: `override: 'light' | 'dark' | 'system'`, `resolved: 'light' | 'dark'`.
- `energy.ts`: `emptyState()` returns the store's model — declare `interface EnergyState` for it.
- `rfid_users.ts`: same `emptyState()` pattern.
- `history.ts`: `/logs/` with paging — type the index parameters as `number`.
- `loadsharing.ts`: `{ peers: LoadSharingPeer[]; status: LoadSharingStatus | null }`; `encodeURIComponent(host: string)`.

- [ ] **Step 2: Fix import specifiers everywhere**

```bash
grep -rln "stores/\(cabletemp\|certificates\|claims\|claims_target\|energy\|history\|loadsharing\|notifications\|plan\|rfid_users\|schedule\|theme\|uisettings\|uistates\)\.js" src \
  | xargs sed -i '' -E "s#(stores/(cabletemp|certificates|claims|claims_target|energy|history|loadsharing|notifications|plan|rfid_users|schedule|theme|uisettings|uistates))\.js#\1#g"
```

Also `src/lib/api/httpAPI.ts`: `'../stores/uistates.js'` → `'../stores/uistates'`. Verify: `grep -rn "stores/[a-z_]*\.js" src` → nothing.

- [ ] **Step 3: Run the gate**

`pnpm check` → 0 errors; tests at the Task 5 baseline; build OK.

- [ ] **Step 4: Commit**

```bash
git add -A src
git commit -m "refactor: convert remaining stores to TypeScript"
```

---

## Phase 3 — Remaining `src/lib` modules

### Module conversion recipe (used by Tasks 7–10)

For each module:

1. `git mv path/name.js path/name.ts` (`*.svelte.js` → `*.svelte.ts`).
2. Add parameter and return types to every exported and internal function. Payload-shaped parameters use `device.ts` types (`import type { … } from '../api/device'`). Values that come from JSON at a trust boundary are `unknown` and narrowed.
3. Replace `.js` on the module's own imports that now point at `.ts` files (the codemod in Task 7 Step 1 does this repo-wide; run it after each batch of renames).
4. Run `pnpm check`; fix every error in the renamed files. Never touch a flag.
5. Run the gate. Commit.

### Task 7: Codemod + leaf modules

**Files:**
- Create: `scripts/strip-js-specifiers.mjs` (deleted again in Task 17)
- Rename + type: `src/lib/{utils,vars,temperature,queue,clipboard,nativeHost,cost,cabletemp,diagnostics,alerts,router,routes}.js` → `.ts`; `src/lib/format/duration.js` → `.ts`

**Interfaces:**
- Produces: `scripts/strip-js-specifiers.mjs` — idempotent; rewrites every `'./x.js'` specifier under `src/` whose `x.ts` exists. `serialQueue.add<T>(fn: () => Promise<T>): Promise<T | false>`. `EvseClients` (in `vars.ts`) as a `Record<number, string>` or its real shape. `temp_round(t: number): number` etc. in `utils.ts`. `redirect(path: string): void` in `router.ts`. `showWriteError(): void` in `alerts.ts`.

- [ ] **Step 1: Write the codemod**

`scripts/strip-js-specifiers.mjs`:

```js
// TypeScript-migration helper. Rewrites relative import / vi.mock specifiers
// that end in ".js" to be extensionless wherever the target now exists as a
// .ts file (including x.svelte.js → x.svelte.ts). Idempotent — safe to re-run
// after every batch of renames. Delete once the migration is complete.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'

const files = execSync("git ls-files 'src/**/*.js' 'src/**/*.ts' 'src/**/*.svelte'", {
  encoding: 'utf8',
})
  .split('\n')
  .filter(Boolean)

// '../stores/config.js'  →  captures quote + '../stores/config'
const SPEC = /(['"])(\.{1,2}\/[^'"\n]+?)\.js\1/g

let changed = 0
for (const file of files) {
  const src = readFileSync(file, 'utf8')
  const out = src.replace(SPEC, (match, quote, spec) => {
    const target = resolve(dirname(file), spec) + '.ts'
    return existsSync(target) ? `${quote}${spec}${quote}` : match
  })
  if (out !== src) {
    writeFileSync(file, out)
    changed++
  }
}
console.log(`strip-js-specifiers: rewrote ${changed} file(s)`)
```

Run it once now: `node scripts/strip-js-specifiers.mjs` → it should report `0 file(s)` (Tasks 5–6 already fixed the store paths). If it reports more, inspect `git diff` — anything it changed is a specifier Tasks 5–6 missed, which is correct to fix.

- [ ] **Step 2: Rename the leaf modules**

```bash
cd src/lib && for m in utils vars temperature queue clipboard nativeHost cost cabletemp diagnostics alerts router routes format/duration; do git mv $m.js $m.ts; done; cd ../..
node scripts/strip-js-specifiers.mjs
```

- [ ] **Step 3: Type each module**

`queue.ts` in full (the only one with a third-party shim):

```ts
import { PromiseBatcher, type SerialQueue as BatchQueue } from 'promise-batching-queue'

// Device writes are serialised through this one queue — the charger's web
// server is single-threaded. Never issue parallel writes.
class SerialQueue {
  private queue: BatchQueue
  timeout: ReturnType<typeof setTimeout> | null
  ispaused: boolean

  constructor() {
    this.queue = PromiseBatcher.newSerialQueue()
    this.timeout = null
    this.ispaused = false
  }

  add = async <T>(fn: () => Promise<T> | T): Promise<T | false> => {
    if (!this.ispaused) {
      const res = await this.queue.queue(fn)
      return Promise.resolve(res)
    } else {
      return false
    }
  }

  pause = (): void => {
    this.ispaused = true
  }

  resume = (): void => {
    this.ispaused = false
  }
}

export const serialQueue = new SerialQueue()
```

`import { PromiseBatcher, type SerialQueue … }` — inline `type` is required by `verbatimModuleSyntax`.

For the others, apply the recipe. Specific guidance:
- `utils.ts`: functions taking device values take `number`/`string`; `clientid2name(id: number): string`; `formatDate(...)` takes what its callers pass (check `DataManager.svelte`). Any function that accepts "a status object" takes `Status` (`import type`).
- `vars.ts`: `export const EvseClients = { … } as const` or a typed `Record<number, string>` — match how `clientid2name` indexes it.
- `routes.ts`: the route table maps `string → Component`; type it `Record<string, Component>` with `import type { Component } from 'svelte'`. `LEGACY_ROUTES: Record<string, string>`.
- `router.ts`: `redirect(path: string): void`; the current-path store is `Writable<string>`.
- `alerts.ts`: uses `uistates_store.update` with `AlertBox` (Task 6) — `showWriteError(): void`.
- `cabletemp.ts`, `cost.ts`, `diagnostics.ts`, `temperature.ts`, `format/duration.ts`: pure helpers — annotate parameters from their tests' usage; return types explicit.
- `nativeHost.ts`, `clipboard.ts`: browser-API wrappers — `navigator.clipboard`, `window` types come from `lib.dom`.

- [ ] **Step 4: Run the gate, including the extension check and screenshots**

```bash
pnpm check && pnpm test 2>&1 | grep -E "Test Files|Tests " && pnpm build
pnpm screenshots && git status --porcelain docs/screenshots     # → nothing
```

plus the dangling-specifier loop from "The gate" → nothing.

- [ ] **Step 5: Commit**

```bash
git add -A scripts/strip-js-specifiers.mjs src
git commit -m "refactor: convert leaf lib modules to TypeScript"
```

### Task 8: `src/lib/config/`

**Files:**
- Rename + type: `backup, divert, firmware, pages, rfid, safety, saveState, tesla, validate, wifi` (`.js` → `.ts`), `configForm.svelte.js` → `configForm.svelte.ts`, `cableTempForm.svelte.js` → `cableTempForm.svelte.ts`

**Interfaces:**
- Consumes: `config_store`, `ConfigState` (Task 5); `serialQueue` (Task 7); `showWriteError` (Task 7); `Config` (Task 2).
- Produces:
  - `saveState.ts`: `export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'`; `createSaveState(): SaveStateStore` where `SaveStateStore extends Readable<Record<string, SaveStatus>> { begin(name: string): void; succeed(name: string): void; fail(name: string): void; statusOf(name: string): SaveStatus }`; `SAVED_LINGER_MS`.
  - `configForm.svelte.ts`: `createConfigForm(): ConfigForm` where `ConfigForm = { saveState: SaveStateStore; saveField<K extends keyof Config>(name: K, value: Config[K]): Promise<boolean>; saveFields(fields: Partial<Config>): Promise<boolean>; readonly revert: number }`.
  - `pages.ts`: `SETTINGS_PAGES: SettingsPage[]` with `interface SettingsPage { key: string; path: string; icon: string; requires?: keyof Config; labs?: boolean; … }` — take the real field list from the file.
  - `validate.ts`, `wifi.ts`, `divert.ts`, `firmware.ts`, `rfid.ts`, `safety.ts`, `tesla.ts`, `backup.ts`: exported function signatures typed; components (Task 16) consume them.

- [ ] **Step 1: Rename and codemod**

```bash
cd src/lib/config && for m in backup divert firmware pages rfid safety saveState tesla validate wifi; do git mv $m.js $m.ts; done
git mv configForm.svelte.js configForm.svelte.ts && git mv cableTempForm.svelte.js cableTempForm.svelte.ts && cd ../../..
node scripts/strip-js-specifiers.mjs
```

Confirm the rune-module specifiers came out as `'…/config/configForm.svelte'` (no extension) — Vite resolves that to `configForm.svelte.ts`; this was verified against Vitest before the plan was written.

- [ ] **Step 2: Type `saveState.ts` and `configForm.svelte.ts` (given in full)**

`saveState.ts`:

```ts
// Per-field save-status state. createSaveState() returns a Svelte store
// mapping field name -> 'saving' | 'saved' | 'error'. A name absent from the
// map is 'idle'. succeed() lingers on 'saved' then auto-clears to 'idle'.
import { writable, get, type Readable } from 'svelte/store'

export const SAVED_LINGER_MS = 2000

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export interface SaveStateStore extends Readable<Record<string, SaveStatus>> {
  begin(name: string): void
  succeed(name: string): void
  fail(name: string): void
  statusOf(name: string): SaveStatus
}

export function createSaveState(): SaveStateStore {
  const store = writable<Record<string, SaveStatus>>({})
  const { subscribe, update } = store
  const timers: Record<string, ReturnType<typeof setTimeout>> = {}

  function clearTimer(name: string): void {
    if (timers[name]) {
      clearTimeout(timers[name])
      delete timers[name]
    }
  }
  function setStatus(name: string, status: SaveStatus): void {
    update((m) => ({ ...m, [name]: status }))
  }

  return {
    subscribe,
    begin(name) {
      clearTimer(name)
      setStatus(name, 'saving')
    },
    succeed(name) {
      clearTimer(name)
      setStatus(name, 'saved')
      timers[name] = setTimeout(() => {
        delete timers[name]
        setStatus(name, 'idle')
      }, SAVED_LINGER_MS)
    },
    fail(name) {
      clearTimer(name)
      setStatus(name, 'error')
    },
    statusOf(name) {
      return get(store)[name] ?? 'idle'
    },
  }
}
```

`configForm.svelte.ts`:

```ts
// Per-field save machinery shared by every config page. createConfigForm()
// returns a saveState store, a `revert` counter (bumped on failure so
// controlled inputs resync to the confirmed store value), and the save fns.
import { config_store, type ConfigState } from '../stores/config'
import { serialQueue } from '../queue'
import { showWriteError } from '../alerts'
import { createSaveState, type SaveStateStore } from './saveState'
import type { Config } from '../api/device'

export interface ConfigForm {
  saveState: SaveStateStore
  saveField<K extends keyof Config>(name: K, value: Config[K]): Promise<boolean>
  saveFields(fields: Partial<Config>): Promise<boolean>
  readonly revert: number
}

export function createConfigForm(): ConfigForm {
  const saveState = createSaveState()
  let revert = $state(0)

  async function saveFields(fields: Partial<Config>): Promise<boolean> {
    const names = Object.keys(fields)
    names.forEach((n) => saveState.begin(n))
    const ok = await serialQueue.add(() => config_store.upload(fields))
    if (ok) {
      config_store.update((c) => ({ ...c, ...fields }) as ConfigState)
      names.forEach((n) => saveState.succeed(n))
    } else {
      names.forEach((n) => saveState.fail(n))
      revert += 1
      showWriteError()
    }
    return ok
  }

  function saveField<K extends keyof Config>(name: K, value: Config[K]): Promise<boolean> {
    return saveFields({ [name]: value } as Partial<Config>)
  }

  return {
    saveState,
    saveField,
    saveFields,
    get revert() {
      return revert
    },
  }
}
```

`{ ...c, ...fields } as ConfigState` keeps the JavaScript behaviour exactly (spreading an `undefined` store yields the fields alone); the cast records that the derived flags are not recomputed here, which is what the JS did too. `serialQueue.add` returns `T | false` and `T` is `boolean`, so `return ok` is already `Promise<boolean>`.

- [ ] **Step 3: Type the remaining ten by the recipe**

`cableTempForm.svelte.ts` follows `configForm.svelte.ts` with `cabletemp_store` (Task 6) and `CableTemp`. `pages.ts` gets the `SettingsPage` interface with the real fields. `validate.ts` functions return `string | null` (or whatever the tests assert — read `validate.test.js` first). `wifi.ts` types the scan result (`{ ssid: string; rssi: number; secure: boolean; … }` — from `dev/fixtures/scan.json`) and, if `uistates.networks` was `unknown[]` in Task 6, tighten it to this type now.

- [ ] **Step 4: Run the full gate (incl. screenshots and dangling check). Commit.**

```bash
git add -A src
git commit -m "refactor: convert config modules to TypeScript"
```

### Task 9: Feature logic modules

**Files:**
- Rename + type: `src/lib/dashboard/{controls,loadsharing,sessionChart,soc,state}.js`; `src/lib/monitoring/metrics.js`; `src/lib/charge_manager/{rules,vehicle}.js`; `src/lib/schedule/timers.js`; `src/lib/history/logs.js`; `src/lib/notifications/notifications.js`; `src/lib/components/charts/chartTheme.js` → all `.ts`

**Interfaces:**
- Consumes: `Status`, `Config`, `Limit`, `Boost`, `Claim`, `ClaimsTarget`, `ScheduleEvent`, `LogEntry`, `Notification(s)`, `EnergySample` (Task 2); `ConfigState` (Task 5).
- Produces: typed exports with their existing names; component tasks 13–14 consume them. In particular `sessionChart.ts` exports the uPlot options builder typed with `uPlot.Options` (from `import uPlot from 'uplot'`), `metrics.ts` exports `MetricGroup`/`MetricRow` shapes that `MetricGroup.svelte`/`MetricRow.svelte` (Task 14) take as props, `logs.ts` exports the `LogRow` view-model that `LogRow.svelte`'s props mirror, `notifications.ts` exports `badgeSignature(n: StatusNotifications | undefined, event: number): string | null` (check the JS for the exact shape).

- [ ] **Step 1: Rename and codemod**

```bash
cd src/lib && git mv dashboard/controls.js dashboard/controls.ts && git mv dashboard/loadsharing.js dashboard/loadsharing.ts \
 && git mv dashboard/sessionChart.js dashboard/sessionChart.ts && git mv dashboard/soc.js dashboard/soc.ts && git mv dashboard/state.js dashboard/state.ts \
 && git mv monitoring/metrics.js monitoring/metrics.ts && git mv charge_manager/rules.js charge_manager/rules.ts && git mv charge_manager/vehicle.js charge_manager/vehicle.ts \
 && git mv schedule/timers.js schedule/timers.ts && git mv history/logs.js history/logs.ts && git mv notifications/notifications.js notifications/notifications.ts \
 && git mv components/charts/chartTheme.js components/charts/chartTheme.ts && cd ../..
node scripts/strip-js-specifiers.mjs
```

- [ ] **Step 2: Type by the recipe**

Notes:
- `dashboard/loadsharing.ts`: `(config: ConfigState | undefined, status: Status | undefined, localMax: number | undefined, claims: …)` — read the signature; the `num()` helper is `(v: unknown) => number`.
- `dashboard/state.ts`: `EvseState` in, display state out — declare the union of display states it returns.
- `dashboard/sessionChart.ts`: `import uPlot from 'uplot'` for `uPlot.Options`, `uPlot.Series`, `uPlot.AlignedData`; the theme argument is the `chartTheme.ts` return type — export `interface ChartTheme` there.
- `monitoring/metrics.ts`: export the row/group interfaces; `MetricsTab`/`MetricGroup`/`MetricRow` props (Task 14) reuse them.
- `history/logs.ts`: export `interface LogRowModel` mirroring `LogRow.svelte`'s props (Task 14 uses `ComponentProps<typeof LogRow>` for the spread; the two must agree — make the model the source and the props match it).
- `schedule/timers.ts`: `ScheduleEvent[]` in; the timer view model out — export its interface for `TimerRow`/`TimerModal` (Task 14).
- `charge_manager/rules.ts`, `vehicle.ts`: exported rule model interface (`id: number | null`, `alwaysOn: boolean`, `action: string`, `days: string[]`, `startTime: string`, `stopTime: string | null`, `chargeCurrent: number | null`, `limit: … | null`, `_startEventId: number | null`, `_stopEventId: number | null` — from the literal at `routes/ChargeManager.svelte:137`).

- [ ] **Step 3: Full gate. Commit.**

```bash
git add -A src
git commit -m "refactor: convert feature logic modules to TypeScript"
```

### Task 10: `src/lib/i18n/` and the Node-side locale script

**Files:**
- Rename + type: `src/lib/i18n/{hydrate,index,locales}.js` → `.ts`
- Modify: `scripts/build-locale-values.mjs:20` (import specifier → `.ts`)
- Modify: `package.json` (add `engines.node`)

**Interfaces:**
- Consumes: nothing new.
- Produces: `hydrate.ts` exports `PATH_SEP`, `keyEntries`, `keyPaths`, `hydrateLocale` with types; **must stay dependency-free and use only erasable TypeScript syntax** (no `enum`, no `namespace`, no parameter properties) because Node loads it directly via built-in type stripping.

- [ ] **Step 1: Confirm Node can load `.ts` here**

Run: `node -e 'console.log(process.features.typescript)'`
Expected: `strip` (Node ≥ 22.18 / 23.6+). CI uses `node-version: '22'`, which resolves to 22.23+, so it strips too. If the local Node prints `false`/`undefined`, upgrade Node before continuing — this task depends on it.

- [ ] **Step 2: Rename and codemod**

```bash
cd src/lib/i18n && git mv hydrate.js hydrate.ts && git mv index.js index.ts && git mv locales.js locales.ts && cd ../../..
node scripts/strip-js-specifiers.mjs
```

- [ ] **Step 3: Point the Node script at the `.ts` file**

`scripts/build-locale-values.mjs` line 20:

```js
import { keyPaths, keyEntries, PATH_SEP } from '../src/lib/i18n/hydrate.ts'
```

(Node ESM needs the explicit extension and does not map `.js` → `.ts`; Vite/esbuild and Vitest accept the `.ts` extension too, so the Vite plugin and the global setup that import this script keep working.)

Add to `package.json` (top level, after `"packageManager"`):

```json
"engines": { "node": ">=22.18" },
```

- [ ] **Step 4: Type the three modules**

`hydrate.ts`: `keyEntries(obj: Record<string, unknown>, prefix = ''): [string, string][]` (or whatever the JS returns — read it), `keyPaths(obj: Record<string, unknown>): string[]`, `hydrateLocale(keySource: Record<string, unknown>, values: string[]): Record<string, unknown>`. Recursive JSON: declare `type Catalog = { [key: string]: string | Catalog }` and use it instead of `Record<string, unknown>` where the JS recurses.
`locales.ts`: the locale list as `readonly` tuples / `as const`.
`index.ts`: `svelte-i18n` `register`/`init` calls are already typed by the library; the dynamic `import()` of the generated `es.json`/`fr.json`/`hu.json` returns `Promise<{ default: string[] }>` — annotate.

- [ ] **Step 5: Verify every path that loads `hydrate`**

```bash
node scripts/build-locale-values.mjs        # → regenerates es/fr/hu.json, exits 0
pnpm test src/lib/i18n                       # global setup + i18n tests pass
pnpm build                                   # the Vite plugin path
```

Then the full gate (check, full test, build, screenshots, dangling check).

- [ ] **Step 6: Commit**

```bash
git add -A src scripts/build-locale-values.mjs package.json
git commit -m "refactor: convert i18n modules to TypeScript"
```

At this point no `.js` remains under `src/lib/` except `__tests__/`. Verify: `git ls-files 'src/lib/**/*.js' | grep -v __tests__` → nothing.

---

## Phase 4 — Components

### Component conversion recipe (used by Tasks 11–16)

For each `.svelte` file:

1. `<script>` → `<script lang="ts">`.
2. If it calls `$props()`: declare `interface Props { … }` directly above the destructure and annotate it `let { … }: Props = $props()`. Rules:
   - Every destructured name with a default is optional (`?`) with the default's type; one without a default is required.
   - `children` / any snippet prop (`badge`) → `Snippet` from `svelte` (`children?: Snippet`; a snippet that takes arguments is `Snippet<[ArgType]>`).
   - Event handler props (`onclick`, `onchange`, `oninput`, …) → the matching `svelte/elements` type (`MouseEventHandler<HTMLButtonElement>`, `ChangeEventHandler<HTMLInputElement>`, `FormEventHandler<HTMLInputElement>`). If the JS default is `() => {}`, the prop is optional.
   - Props forwarded to a DOM attribute reuse the DOM union: `type?: HTMLButtonAttributes['type']`, `inputmode?: HTMLInputAttributes['inputmode']`.
   - A prop that is a fixed set of strings → literal union (`variant?: 'primary' | 'ghost'`; `tone?: 'default' | 'muted' | 'accent' | …` — enumerate from the component's own lookup table or usages, e.g. the `variants` object in `Button.svelte`).
   - `status` on `FormField` → `SaveStatus` (Task 8).
   - Payload-shaped props (`samples`, `rows`, `view`, `group`) → the `device.ts` / feature-module types (Tasks 2, 9).
   - `class: klass` → `class?: string` in the interface (the property name is `class`; destructuring renames it).
3. Type every `let x = $state(...)` whose initial value is `null`/`undefined`/`[]`: `$state<Foo | null>(null)`, `$state<string[]>([])`. `$derived` needs no annotation unless it starts from `null`.
4. Store reads keep `$store?.field`; store values are typed by the stores, so nothing to add.
5. Local functions get parameter/return types. DOM handlers: `(e: Event)`, then `e.currentTarget as HTMLInputElement` or `e.target instanceof HTMLInputElement`.
6. No TypeScript in markup. If a template expression needs a cast or non-null assertion, move it to a `$derived` in the script.
7. `pnpm check` → fix every error in the converted files. Run the gate. Commit per task.

Worked example — `src/lib/components/ui/Toggle.svelte` before:

```svelte
<script>
  let { checked = false, disabled = false, label = '', onchange = () => {} } = $props()
</script>
```

after:

```svelte
<script lang="ts">
  import type { ChangeEventHandler } from 'svelte/elements'

  interface Props {
    checked?: boolean
    disabled?: boolean
    label?: string
    onchange?: ChangeEventHandler<HTMLInputElement>
  }
  let { checked = false, disabled = false, label = '', onchange = () => {} }: Props = $props()
</script>
```

(Confirm from the markup which element `onchange` is bound to — if the component calls `onchange(checked)` with a boolean instead of forwarding the DOM event, the type is `(checked: boolean) => void`.)

Worked example — `src/lib/components/config/FormField.svelte`:

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte'
  import Icon from '../../icons/Icon.svelte'
  import type { SaveStatus } from '../../config/saveState'

  interface Props {
    label?: string
    description?: string
    status?: SaveStatus
    // `badge` is an optional snippet rendered immediately after the label — the
    // slot an advisory marker sits in, beside the very switch it is about.
    badge?: Snippet
    children?: Snippet
  }
  let { label = '', description = '', status = 'idle', badge, children }: Props = $props()
</script>
```

Worked example — the spread in `src/lib/components/history/LogList.svelte`:

```svelte
<script lang="ts">
  import type { ComponentProps } from 'svelte'
  import LogRow from './LogRow.svelte'

  interface Props {
    rows?: ComponentProps<typeof LogRow>[]
  }
  let { rows = [] }: Props = $props()
</script>
```

`LogRow.svelte`'s own `Props` must be declared (same task) so `ComponentProps<typeof LogRow>` resolves; make it match `LogRowModel` from `history/logs.ts` (Task 9) — simplest is `interface Props extends LogRowModel {}` if the fields are identical.

### Task 11: `src/lib/components/ui/` (18 components)

**Files:** `AlertBox, Button, Card, IconButton, Loader, Modal, NumberInput, PasswordInput, Popover, ProgressBar, ProgressRing, SegmentedControl, Select, Slider, StatChip, Tabs, TextInput, Toggle` (`.svelte`)

**Interfaces:**
- Consumes: `AlertBox` type (Task 6) for `AlertBox.svelte`; `SaveStatus` is *not* used here (inputs receive `status` via `FormField`).
- Produces: each component's `Props` — the contract every later task's call sites are checked against. Notably: `Button` `variant?: 'primary' | 'ghost'` (plus any other keys in its `variants` table), `type?: HTMLButtonAttributes['type']`, `onclick?: MouseEventHandler<HTMLButtonElement>`; `StatChip` `value: string | number`, `label: string`, `sub?: string | null`, `subTone?: 'accent' | …`; `Select` options typed `{ value: string | number; label: string }[]` (read the component); `SegmentedControl`/`Tabs` item arrays typed likewise; `Slider`/`NumberInput` `value: number`, `min`, `max`, `step`, `oninput`/`onchange`; `TextInput`/`PasswordInput` `value: string`, `revert?: number` (the `createConfigForm().revert` counter), `onchange`.

- [ ] **Step 1: Apply the recipe to all 18 files**

Start with `Button.svelte` (the spec's worked example):

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { HTMLButtonAttributes, MouseEventHandler } from 'svelte/elements'

  interface Props {
    label?: string
    variant?: keyof typeof variants
    disabled?: boolean
    type?: HTMLButtonAttributes['type']
    onclick?: MouseEventHandler<HTMLButtonElement>
    children?: Snippet
  }
  let {
    label = '',
    variant = 'primary',
    disabled = false,
    type = 'button',
    onclick = () => {},
    children,
  }: Props = $props()

  const variants = {
    primary: 'bg-accent text-surface',
    ghost: 'bg-transparent text-text border border-border',
  }
</script>
```

`keyof typeof variants` keeps the union in one place; if `const variants` is declared after `Props`, TypeScript still resolves it (type positions are hoisted). Every input component that takes `revert` types it `revert?: number`.

- [ ] **Step 2: Run `pnpm check` and fix every error in `ui/`**

Errors here are in the converted components only. Typical: an `$state(null)` needing a generic; an event handler destructuring `e.target.value` needing `(e.currentTarget as HTMLInputElement).value`.

- [ ] **Step 3: Full gate (tests, build, screenshots, dangling). Commit.**

```bash
git add -A src/lib/components/ui
git commit -m "refactor: convert ui primitives to TypeScript"
```

### Task 12: `config/`, `charts/`, `shell/`, `icons/`, `assets/`

**Files:**
- `src/lib/components/config/`: `CertificateModal, ConfigPage, ConfigPlaceholder, ConfigSection, ConsoleViewer, CredentialFields, FormField, ReadOnlyRow, RfidUserModal`
- `src/lib/components/charts/`: `EnergyLiveChart, EnergySummaryChart, UplotChart`
- `src/lib/components/shell/`: `AppShell, BottomNav, ConnectionBanners, DisconnectOverlay, Header`
- `src/lib/icons/Icon.svelte`, `src/assets/ChargePointMark.svelte`

**Interfaces:**
- Consumes: `SaveStatus` (Task 8), `Certificate`, `RfidUsers`, `EnergySample`, `EnergyDaily` etc. (Task 2), `ChartTheme` (Task 9), `Button`/`Modal`/… `Props` (Task 11).
- Produces: `FormField` `status?: SaveStatus`; `ConfigPage` `title?: string; loading?: boolean; children?: Snippet`; `ConfigSection` `title?: string; children?: Snippet`; `ReadOnlyRow` `tone?: 'default' | …`; `UplotChart` `opts: uPlot.Options; data: uPlot.AlignedData; fill?: boolean`; `EnergyLiveChart` `samples?: EnergySample[]`; `EnergySummaryChart` `rows?: …` (the daily/monthly/annual row union); `Icon` `icon: string; size?: number; class?: string`; `ConsoleViewer` `mode?: 'debug' | 'evse'` (check the component for its mode set); `ConnectionBanners`/`Header`/`BottomNav` boolean/string props as listed in their destructures.

- [ ] **Step 1: Apply the recipe to all 19 files**
- [ ] **Step 2: `pnpm check`, fix errors in these directories only**
- [ ] **Step 3: Full gate. Commit.**

```bash
git add -A src/lib/components/config src/lib/components/charts src/lib/components/shell src/lib/icons src/assets
git commit -m "refactor: convert config, chart and shell components to TypeScript"
```

### Task 13: `dashboard/` and `charge_manager/`

**Files:**
- `src/lib/components/dashboard/`: `BoostCard, ChargeControls, ChargeLimitCard, ChargingHero, LimitSliderBar, LoadSharingCard, PlugPill, PowerRing, RatePill, SessionChart, ShaperDivertRow, StatChips, ThrottleBadge, VehicleSocBar`
- `src/lib/components/charge_manager/`: `ConditionalSection, DefaultStateCard, DefaultStateSettingsModal, GlobalFeatureCard, GlobalFeaturePicker, GlobalSection, RuleCard, RuleModal, TempProtectionCard`

**Interfaces:**
- Consumes: `Status`, `Limit`, `Boost`, `Override`, `ClaimsTarget` (Task 2); `limit_store`, `boost_store`, `override_store` surfaces (Task 5); `dashboard/*` and `charge_manager/*` module types (Task 9); `ui/` Props (Task 11).
- Produces: `LoadSharingCard` `view: LoadSharingView` (the return type of `dashboard/loadsharing.ts`'s builder — export it there if Task 9 did not); `SessionChart` `samples?: EnergySample[]; voltage?: number; target?: number | null; sessionElapsed?: number; phases?: 1 | 3`; `PlugPill` `connected?: boolean`; `RuleCard` `rule: Rule` (Task 9's rule model) and its handler props.

- [ ] **Step 1: Apply the recipe to all 23 files**

`BoostCard.svelte:130` assigns `{ remaining, at }` to something initialised `null` — that `$state(null)` becomes `$state<{ remaining: number; at: number } | null>(null)`. Expect several of these in this batch.

- [ ] **Step 2: `pnpm check`, fix errors in these two directories**
- [ ] **Step 3: Full gate. Commit.**

```bash
git add -A src/lib/components/dashboard src/lib/components/charge_manager
git commit -m "refactor: convert dashboard and charge manager components to TypeScript"
```

### Task 14: `monitoring/`, `schedule/`, `notifications/`, `history/`, `wizard/`

**Files:**
- `src/lib/components/monitoring/`: `EnergyTab, HealthTab, ManagerTab, MetricGroup, MetricRow, MetricsTab`
- `src/lib/components/schedule/`: `DayPicker, TimerList, TimerModal, TimerRow`
- `src/lib/components/notifications/`: `AdvisoryMarker, AdvisoryStrip, NotificationBell, NotificationPanel`
- `src/lib/components/history/`: `LogList, LogRow`
- `src/lib/components/wizard/`: `FinishDialog, WizardShell`, `steps/{EvseBasics, FirmwareInfo, Security, TimeStep, Welcome, Wifi}`

**Interfaces:**
- Consumes: `metrics.ts` group/row types, `timers.ts` timer model, `logs.ts` `LogRowModel`, `notifications.ts` types (Task 9); `Notification(s)`, `ScheduleEvent`, `LogEntry` (Task 2); wizard steps use `config_store`/`status_store` (Task 5) and `wifi.ts` (Task 8).
- Produces: `MetricGroup` `group: MetricGroupModel; expanded?: boolean`; `MetricRow` `labelKey: string; value: string | number | null; unit?: string; textKey?: string`; `MetricsTab` `groups?: MetricGroupModel[]`; `ManagerTab` `rows?: …`; `AdvisoryMarker` `marker?: Marker | null`; `LogRow` `Props extends LogRowModel`; `LogList` `rows?: ComponentProps<typeof LogRow>[]`; `EvseBasics` `evseConnected?: boolean; bypassRemaining?: number`.

- [ ] **Step 1: Apply the recipe to all 24 files** (the `LogList`/`LogRow` worked example is in the recipe)
- [ ] **Step 2: `pnpm check`, fix errors in these directories**
- [ ] **Step 3: Full gate. Commit.**

```bash
git add -A src/lib/components/monitoring src/lib/components/schedule src/lib/components/notifications src/lib/components/history src/lib/components/wizard
git commit -m "refactor: convert monitoring, schedule, notification, history and wizard components to TypeScript"
```

### Task 15: `src/lib/data/` — `FetchData`, `WebSocket`, `DataManager`

**Files:** `src/lib/data/{FetchData,WebSocket,DataManager}.svelte`

**Interfaces:**
- Consumes: every store (Tasks 5–6), `serialQueue` (Task 7), `Status` (Task 2), `badgeSignature`, `clientid2name`, `formatDate`, `EvseClients` (Tasks 7, 9).
- Produces: `DataManager`'s exported `refreshXStore(ver: number | undefined): Promise<void>` functions keep their names and gain types; `WebSocket` merges `Partial<Status>` frames into `status_store`.

- [ ] **Step 1: Apply the recipe**

`DataManager.svelte` specifics:
- The `derived(status_store, ($s) => $s?.config_version)` lines need no annotations — `$s` is `Status | undefined`, the result `Readable<number | undefined>`.
- `let counter_divert_update` and the other three timer handles: `let counter_divert_update: ReturnType<typeof setTimeout> | undefined`.
- `export async function refreshConfigStore(ver: number | undefined): Promise<void>` — match each function's real parameter; the version counters are `number | undefined` because the store may not have loaded.
- `$effect` bodies compare versions with `uistates_store`'s counters (`UiStates`, Task 6) — the types line up.

`WebSocket.svelte`: the parsed frame is `JSON.parse(event.data) as Partial<Status>`; the merge into `status_store` is `status_store.update((s) => ({ ...(s ?? {}), ...frame }) as Status)` — the cast is honest (a frame on top of an undefined store is a partial status; the JS did the same). Keep the reconnect/backoff logic byte-for-byte apart from annotations; `let socket: WebSocket | null`, `let retryTimer: ReturnType<typeof setTimeout> | null`.

`FetchData.svelte`: the sequential `await store.download()` chain is already boolean-typed by the stores.

- [ ] **Step 2: `pnpm check`, fix errors in `data/`**

Run `pnpm test src/lib/data` explicitly — `data-components.test.js` and `notification-gate.test.js` exercise these three closely.

- [ ] **Step 3: Full gate. Commit.**

```bash
git add -A src/lib/data
git commit -m "refactor: convert data-layer components to TypeScript"
```

### Task 16: Routes, `App.svelte`, `Router.svelte`

**Files:**
- `src/routes/`: `ChargeManager, Dashboard, History, Login, Monitoring, NotFound, Schedule, Settings, Wizard`
- `src/routes/settings/`: `About, Certificates, Display, Emoncms, Evse, Firmware, Http, LoadSharing, Mqtt, Network, Ocpp, Rfid, Safety, Shaper, Solar, Terminal, Time, Vehicle`
- `src/App.svelte`, `src/lib/components/Router.svelte`

**Interfaces:**
- Consumes: everything above. `createConfigForm(): ConfigForm` (Task 8) — every settings page calls `form.saveField(name, value)`; with `name: keyof Config` the checker now validates every config key a page writes.
- Produces: nothing new; these are leaves of the component tree.

- [ ] **Step 1: Apply the recipe to all 29 files**

Settings pages share one shape (`Emoncms.svelte` is the smallest — do it first as the template):

```svelte
<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { config_store } from '../../lib/stores/config'
  import { status_store } from '../../lib/stores/status'
  import { createConfigForm } from '../../lib/config/configForm.svelte'
  // … component imports unchanged (.svelte extensions stay) …

  const form = createConfigForm()
  const ss = form.saveState

  let enabled = $derived(!!$config_store?.emoncms_enabled)
  let connected = $derived($status_store?.emoncms_connected === 1)
</script>
```

Nothing but `lang="ts"` changes in most pages — the types flow from the stores. Where a page builds a `saveFields({...})` object from local state, the object must be a `Partial<Config>`; a wrongly spelled key is now an error (that is the point). `Terminal.svelte`, `Mqtt.svelte`, `LoadSharing.svelte`, `Evse.svelte`, `Vehicle.svelte` had the most baseline errors — expect `$state(null)` generics and DOM-event casts there.

`Dashboard.svelte:205` and `:336` — the `maxRange` "possibly null" sites: they are guarded by `Number.isFinite(maxRange)` / a ternary; if the checker still complains, narrow in a `$derived` (recipe rule 6) rather than asserting in markup.

`About.svelte`/`Firmware.svelte` read `__APP_VERSION__` — typed by `src/global.d.ts` (Task 1).

`Router.svelte` takes `routes`, `fallback` and `aliases`:

```svelte
<script lang="ts">
  import type { Component } from 'svelte'
  import { currentPath, redirect } from '../router'

  interface Props {
    routes?: Record<string, Component>
    fallback?: Component
    aliases?: Record<string, string>
  }
  let { routes = {}, fallback, aliases = {} }: Props = $props()

  // A legacy path renders nothing for the one tick it takes the redirect
  // to land — never the fallback, which would flash a 404.
  let Component = $derived<Component | null | undefined>(
    routes[$currentPath] ?? (aliases[$currentPath] ? null : fallback),
  )

  $effect(() => {
    const target = aliases[$currentPath]
    if (target) redirect(target)
  })
</script>
```

`routes.ts` (Task 7) must export its table as `Record<string, Component>` and `LEGACY_ROUTES` as `Record<string, string>` for this to line up.

`App.svelte`: `$config_store?.wizard_passed` is already typed.

- [ ] **Step 2: `pnpm check`, fix errors in `routes/`, `App.svelte`, `Router.svelte`**
- [ ] **Step 3: Full gate. Commit.**

```bash
git add -A src/routes src/App.svelte src/lib/components/Router.svelte
git commit -m "refactor: convert routes and app shell to TypeScript"
```

- [ ] **Step 4: Confirm the tree is fully converted**

```bash
git ls-files 'src/**/*.js' | grep -v __tests__ | grep -v test-setup.js      # → nothing
git ls-files 'src/**/*.svelte' | grep -v __tests__ | xargs grep -l '<script>'   # → nothing (every component has a <script>, so every one must carry lang="ts")
```

---

## Phase 5 — End state

### Task 17: Narrow the config, remove the scaffolding, update the docs

**Files:**
- Modify: `tsconfig.json`
- Delete: `scripts/strip-js-specifiers.mjs`
- Modify: `CLAUDE.md`, `AGENTS.md`

**Interfaces:**
- Consumes: the fully converted tree from Task 16.
- Produces: the final `pnpm check` contract: `0 errors, 0 warnings`.

- [ ] **Step 1: Tighten `tsconfig.json`**

Remove `"allowJs": true` and `"checkJs": false` and their comment; set:

```jsonc
  "include": ["src/**/*.ts", "src/**/*.svelte", "src/**/*.d.ts"],
  "exclude": ["src/**/__tests__/**"]
```

Run `pnpm check` → `0 errors and 0 warnings`. If a warning appears, fix its cause (unused-export or a11y warnings from svelte-check are real and cheap).

- [ ] **Step 2: Remove the codemod**

```bash
node scripts/strip-js-specifiers.mjs   # → "rewrote 0 file(s)" — proves nothing is left for it to do
git rm scripts/strip-js-specifiers.mjs
```

- [ ] **Step 3: Update `AGENTS.md`**

- In the Commands block add, after `pnpm test`:
  `pnpm check            # svelte-check, strict TypeScript — must pass before committing`
- In "Architecture rules", after the first bullet, add:
  `- **TypeScript everywhere in \`src/\` except tests.** Modules are \`.ts\` (\`*.svelte.ts\` for rune modules); components use \`<script lang="ts">\` with an \`interface Props\`. The device API is typed in \`src/lib/api/device.ts\` — add a field there (optional if capability-gated) before reading it anywhere, and keep \`dev/fixtures/\` in agreement (\`device.check.ts\` enforces this).`
- In "After any UI-visible change" step 1: `pnpm check`, `pnpm test` and `pnpm build` must pass.

- [ ] **Step 4: Update `CLAUDE.md`**

- Commands block: add `pnpm check` with the same comment.
- "How data flows": `src/lib/api/httpAPI.js` → `.ts`; add: "`httpAPI<T>()` resolves to `T | 'error'`; narrow with `res !== 'error'` and `isErrorBody()`."
- "Config pages": `configForm.svelte.js` → `configForm.svelte.ts`; "Modules that use runes outside a component are named `*.svelte.ts`"; `saveField(name, value)` is typed against `Config` so a wrong key is a check error.
- "Tests": `vi.mock()` targets are extensionless (`vi.mock('../stores/config')`); tests remain JavaScript and are excluded from `pnpm check`.
- "Device facts": keep the sentence about units but point at `src/lib/api/device.ts` as the source of truth: "Field types and units are declared in `src/lib/api/device.ts`; capability-gated fields are optional there."

- [ ] **Step 5: Final gate — the complete set**

```bash
pnpm check                                       # 0 errors, 0 warnings
pnpm test 2>&1 | grep -E "Test Files|Tests "     # 144 / 1157
pnpm build
pnpm screenshots && git status --porcelain docs/screenshots   # nothing
node scripts/build-locale-values.mjs             # exits 0
git ls-files 'src/**/*.js' | grep -v __tests__ | grep -v test-setup.js   # nothing
```

- [ ] **Step 6: Commit**

```bash
git add -A tsconfig.json scripts CLAUDE.md AGENTS.md
git commit -m "chore: finish TypeScript migration — strict config, docs"
```

---

## Self-review notes

- **Spec coverage:** Phase 1 → Task 1. Phase 2 (`device.ts`, `device.check.ts`, `httpAPI`, stores, `DeviceStore`) → Tasks 2–6. Phase 3 (66 modules, codemod, extension check, `.svelte.ts`) → Tasks 7–10; the Node-side `hydrate` dependency the spec did not foresee is handled in Task 10 (spec non-goal "Node-side code stays JS" is preserved — the script stays `.mjs` and imports `.ts` via Node's built-in stripping). Phase 4 (recipe, prop rules, order, `ComponentProps` spread) → Tasks 11–16. Phase 5 (config narrowing, docs) → Task 17. Verification gate → "The gate" + every task's last steps. Awkward-case rules → Global Constraints and Task 5 Step 3 (bug-fix-first commits).
- **Type consistency:** `ApiResult<T>`/`isErrorBody` (Task 4) used in Tasks 5–6; `DeviceStore<T>` (Task 5) used in Task 6; `SaveStatus`/`SaveStateStore`/`ConfigForm` (Task 8) used in Tasks 11–16; `LogRowModel` (Task 9) ↔ `LogRow` Props (Task 14); `UiStates`/`AlertBox` (Task 6) used in Tasks 7, 11, 15; store export names unchanged (`certificate_store`, `notification_store`, …).
- **Baseline drift:** Task 5 Step 3 adds exactly one test (override download failure); 144 / 1157 from then on.
