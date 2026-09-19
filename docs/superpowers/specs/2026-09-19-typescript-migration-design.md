# TypeScript Migration Design

**Date:** 2026-09-19
**Status:** Approved

## Problem

The app is a client of a JSON API served by C++ firmware. Nothing in the
repo describes the shape of that API: every store is an untyped
`writable()`, `httpAPI()` returns `unknown | 'error'`, and facts such as
"`amp` is milliamps" or "an absent `boost_version` means old firmware" live
only in `CLAUDE.md`. Component props are likewise untyped — `Button`'s
`type` is a `string` where the DOM wants `'button' | 'submit' | 'reset'`.

`jsconfig.json` already sets `checkJs: true`, but nothing runs a checker:
no script, no CI step. Running `svelte-check` against the current tree
reports **2,026 errors in 241 files** (882 implicit-`any`, 464 "property
does not exist" on the untyped stores, 210 missing component props, ~90
possible-null). The editor shows these; nobody enforces them; the habit
of ignoring red squiggles follows.

This is a personal fork with no upstream to keep diffs small for, so the
chosen scope is a **full conversion**: every module and component becomes
TypeScript under `strict: true`, with a checker gating CI.

## Goals

- `src/lib/api/device.ts` is the single typed description of every device
  payload the app reads or writes, including units and capability gating.
- Every `src/lib/**` module is `.ts`; every component is
  `<script lang="ts">` with typed `$props()`.
- `pnpm check` (`svelte-check`, `strict: true`) reports 0 errors and runs
  in CI beside `test` and `build`.
- No user-visible or runtime behaviour change. The build output embedded
  into the firmware is the same program, minus erased types.
- The tree is green (`check` + `test` + `build`) at every commit so the
  migration can pause, ship, or bisect at any point.

## Non-goals

- Tests stay JavaScript. `src/**/__tests__/**` and `src/test-setup.js` are
  excluded from the type check.
- Node-side code stays JavaScript: `dev/`, `scripts/`, `vite.config.js`,
  `vitest.config.js`, `svelte.config.js`. They run under Node directly,
  not through Vite.
- No lint or formatter is added.
- No `$lib` path alias; imports stay relative.
- TypeScript 6 only. No TypeScript 7 / `tsgo` (svelte-check 4.7 rejects
  TS 7 without it, and it needs both versions installed).
- No branded unit types (milliamps vs amps stay `number` with a doc
  comment), no typed i18n keys.
- No runtime refactors along the way — `httpAPI` keeps returning the
  string `'error'`; stores keep initialising to `undefined`.

## Approach

Phased and always green, strict from the first commit:

| Phase | Converts | Gate |
|---|---|---|
| 1 | Tooling: `tsconfig`, `svelte-check`, CI, ambient declarations | `check` green on the unchanged JS tree |
| 2 | `device.ts` contract; `api/` and `stores/` to `.ts` | `check` + `test` + `build` |
| 3 | Remaining `src/lib/**/*.js` to `.ts`, import codemod | `check` + `test` + `build` + screenshots clean |
| 4 | Components to `<script lang="ts">`, bottom-up by directory | `check` + `test` + `build` + screenshots clean |
| 5 | End state: drop `allowJs`/`checkJs`, narrow `include`, docs | all of the above, 0 errors 0 warnings |

The key setting is **`strict: true` with `checkJs: false` from phase 1**.
svelte-check then reports only `.ts` files and `lang="ts"` components, so
the gate is green on day one and every file is checked strictly the moment
it is converted — there is no second "tighten" pass. Unconverted JS still
feeds loosely inferred types into converted files; that is harmless and
self-heals as conversion proceeds bottom-up.

Rejected alternatives: a growing `include` allowlist under strict (leaks
loose types through imports anyway, adds bookkeeping); a big-bang rename
followed by a burn-down (tree red for the whole stretch, no bisecting, CI
and screenshots dead until the end).

## Phase 1 — Tooling

- `pnpm add -D typescript@~6 svelte-check @types/luxon`
- `jsconfig.json` → `tsconfig.json`. Keep every current option
  (`moduleResolution: bundler`, `verbatimModuleSyntax`, `isolatedModules`,
  `resolveJsonModule`, `sourceMap`, `esModuleInterop`, `skipLibCheck`,
  `types: ["vite/client"]`) and add:

  ```jsonc
  "strict": true,
  "allowJs": true,
  "checkJs": false,
  "include": ["src/**/*.ts", "src/**/*.js", "src/**/*.svelte", "src/**/*.d.ts"],
  "exclude": ["src/**/__tests__/**", "src/test-setup.js"]
  ```

- `svelte.config.js`: `preprocess: vitePreprocess()` from
  `@sveltejs/vite-plugin-svelte` — required for `<script lang="ts">`.
- `src/global.d.ts`:
  - `declare const __APP_VERSION__: string` (injected by Vite `define`).
  - `declare module 'promise-batching-queue'` shaped to exactly the API
    `src/lib/queue.js` uses; the package ships no types and has no
    `@types` entry.
- `package.json`: `"check": "svelte-check --tsconfig ./tsconfig.json"`.
- `.github/workflows/test.yml`: a `check` step after `pnpm install`.
- `vitest.config.js`: coverage `include` → `src/lib/**/*.{js,ts}` so
  coverage does not silently drop as files rename.

Dependency typing status, for reference: `uplot`, `svelte-i18n`,
`iconify-icon`, `svelte-local-storage-store` ship their own declarations;
`luxon` needs `@types/luxon`; `promise-batching-queue` needs the shim.

## Phase 2 — The device contract

### `src/lib/api/device.ts`

A types-only module. Consumers use `import type`, which
`verbatimModuleSyntax` already enforces, so nothing from it can reach the
bundle.

One interface per payload the app reads or writes:

| Interface | Endpoint | Notes |
|---|---|---|
| `Status` | `GET /status`, WebSocket frames | includes every `*_version` counter |
| `Config` | `GET /config`, `POST /config` | |
| `Override` | `GET/POST/PATCH/DELETE /override` | |
| `Limit` | `GET/POST/DELETE /limit` | `auto_release` discriminates system vs user |
| `ScheduleEvent` | `GET/POST /schedule`, `DELETE /schedule/:id` | |
| `Plan` | `GET /schedule/plan` | |
| `Claim`, `ClaimsTarget` | `GET /claims`, `GET /claims/target` | |
| `Certificate` | `GET/POST /certificates`, `POST /certificates/self-signed`, `DELETE /certificates/:id` | |
| `Notifications` | `GET /notifications` | |
| `Boost` | `GET/POST/DELETE /boost` | |
| `EnergyRaw`, `EnergyDaily`, `EnergyMonthly`, `EnergyAnnual` | `GET /energy/raw[?before=]`, `/energy/daily`, `/energy/monthly`, `/energy/annual` | |
| `RfidUser` | `GET/POST /rfid/users` | |
| `LogEntry` | `GET /logs/` | |
| `CableTemp` | `GET/POST /cabletemp` | |
| `LoadSharingStatus`, `LoadSharingPeer` | `GET /loadsharing/status`, `GET/POST/PUT /loadsharing/peers`, `DELETE /loadsharing/peers/:host`, `POST /loadsharing/discover` | |
| `EvseState` | — | `1 \| 2 \| 3 \| 4 \| … \| 11 \| 254 \| 255` |
| `WriteResponse` | every `POST`/`PATCH`/`DELETE` | `{ msg: 'done' \| 'no change' \| string }` |

Endpoints are those the stores call today. Field lists are taken from
the existing stores and `dev/fixtures/*.json` during implementation; the
table names the types, not the final field set.

Rules for the field lists:

- Fields come from `dev/fixtures/*.json` plus every field the app reads.
- **Capability-gated fields are optional.** `boost_version?`, `limit?`,
  `notifications?`, and anything else whose absence from `/status` means
  "firmware predates this feature". This is the "gate on presence, never
  on values" rule expressed in the type system.
- Fields the firmware always sends are required.
- Units live in doc comments on the field: `/** milliamps */ amp: number`,
  `/** tenths of °C */ temp: number`, `/** Wh */ session_energy: number`,
  `/** kWh */ total_energy: number`. The "Device facts" paragraph in
  `CLAUDE.md` becomes a pointer to this file.

### `src/lib/api/device.check.ts`

Imports each fixture in `dev/fixtures/` and asserts it with `satisfies`
against its interface. Nothing imports this file; svelte-check checks it
because `include` covers `src/**/*.ts`. A header comment says why it
exists. Because an imported JSON is not a fresh object literal, this
checks that every required field is present with the right type; it does
not flag extra fixture fields, which is acceptable.

### `httpAPI`

```ts
export async function httpAPI<T = unknown>(
  method: string, url: string, body: string | null = null,
  type: 'json' | 'text' = 'json', timeout = 60000,
): Promise<T | 'error'>
```

Runtime unchanged. Callers pass the payload type
(`httpAPI<Status>('GET', '/status')`) and `res === 'error'` narrows the
rest of the branch.

### Stores

Each store's real surface is typed. The common shape is shared:

```ts
export interface DeviceStore<T> extends Writable<T | undefined> {
  download(): Promise<boolean>
}
```

Stores with an `upload` (or other writes) extend it with their specific
signatures. Stores that initialise to a value rather than `undefined`
(`certificates`, `claims`, `schedule`, `energy`, `rfid_users`,
`loadsharing`, `theme`, `uistates`, and the `model`-seeded ones) are typed
non-optional to match. The `$store?.field` convention in components
(350 existing sites) carries over as-is.

## Phase 3 — Module conversion

- `git mv` every non-test `src/lib/**/*.js` to `.ts` (66 modules).
  `configForm.svelte.js` and `cableTempForm.svelte.js` become
  `*.svelte.ts` — the runes-outside-components convention keeps the
  `.svelte.` infix.
- Import specifiers: a codemod rewrites `'./x.js'` → `'./x'` for every
  renamed module, in app code (325 sites) and in tests including
  `vi.mock()` targets (245 sites), which Vite resolves against the disk.
  `.svelte` and `.json` imports keep their extensions. The phase gate
  includes `grep -rn "\.js'" src/` showing only specifiers that still
  point at JavaScript files.
- Order: leaves first (`utils`, `vars`, `format/`, `temperature`, `queue`,
  `clipboard`, `nativeHost`) → `api/` and `stores/` (phase 2) → `config/`,
  `dashboard/`, `monitoring/`, `schedule/`, `charge_manager/`, `history/`,
  `notifications/`, `i18n/`, `router`, `routes`, `alerts`, `diagnostics`,
  `cost`, `cabletemp`, `components/charts/chartTheme`.
- Each module is annotated under `strict` as it is renamed: parameter and
  return types, `unknown` at trust boundaries with narrowing.

## Phase 4 — Components

All 115 `<script>` blocks are already Svelte 5 runes: no `export let`,
`createEventDispatcher`, `$$restProps`, or `<svelte:component>`. The
conversion is one shape applied uniformly:

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { MouseEventHandler, HTMLButtonAttributes } from 'svelte/elements'

  interface Props {
    label?: string
    variant?: 'primary' | 'ghost'
    disabled?: boolean
    type?: HTMLButtonAttributes['type']
    onclick?: MouseEventHandler<HTMLButtonElement>
    children?: Snippet
  }
  let { label = '', variant = 'primary', disabled = false, type = 'button',
        onclick = () => {}, children }: Props = $props()
</script>
```

Prop typing rules:

- `children?: Snippet`; event props via `svelte/elements`; DOM
  passthroughs reuse the DOM's own unions.
- String-enum props become literal unions (`variant`, `status:
  'saving' | 'saved' | 'error'`, …). Every call site of the 18 `ui/`
  primitives is then checked.
- Store-derived values are typed from `device.ts`.
- TypeScript is not allowed in markup, so casts and narrowing live in
  `$derived` in the script.
- The one component spread (`<LogRow {...row}>` in `LogList.svelte`) types
  `row` as `ComponentProps<typeof LogRow>`.

Order, bottom-up, one commit per directory:
`ui/` → `config/`, `charts/`, `shell/` → `dashboard/`, `charge_manager/`,
`monitoring/`, `schedule/`, `notifications/`, `history/`, `wizard/` →
`data/` → `routes/`, `routes/settings/` → `App.svelte` and the three
singletons `components/Router.svelte`, `icons/Icon.svelte`,
`assets/ChargePointMark.svelte`.

## Phase 5 — End state

- No `.js` under `src/` except `__tests__/` and `test-setup.js`.
- `tsconfig.json` drops `allowJs` and `checkJs`; `include` narrows to
  `src/**/*.ts`, `src/**/*.svelte`, `src/**/*.d.ts`.
- `pnpm check` → `0 errors, 0 warnings`.
- Docs: `CLAUDE.md` and `AGENTS.md` command lists gain `pnpm check`;
  path references (`configForm.svelte.js`, `httpAPI.js`, `queue.js`, …)
  become `.ts`; "Modules that use runes outside a component are named
  `*.svelte.ts`"; "Device facts" points at `device.ts`; the tests section
  notes that `vi.mock()` targets are extensionless.

## Verification

Every commit, in every phase:

1. `pnpm check` → 0 errors.
2. `pnpm test` → all pass, with the **same test-file and test counts** as a
   baseline recorded before phase 1.
3. `pnpm build` succeeds.

From phase 3 on, additionally `pnpm screenshots` followed by
`git status --porcelain docs/screenshots` being empty. The renderer is
deterministic, so any pixel diff is a real behaviour change and fails the
gate.

## Rules for the awkward cases

- A type error that reveals a real bug is fixed in its own commit, with a
  test, before the conversion commit — never papered over.
- `// @ts-expect-error` (never `@ts-ignore`) is allowed only for
  third-party typing gaps and must carry a reason on the same line.
- Explicit `any` is not used in app code; `unknown` plus narrowing
  instead. The only `any`-shaped thing permitted is inside the
  `promise-batching-queue` shim, and only where its API genuinely cannot
  be expressed.
- `device.check.ts` failing means fixture and contract disagree: fix
  whichever is wrong. If the app reads a field no fixture has, add it to
  the fixture — mock mode must cover every call the app makes.
- A component whose props cannot be typed without changing behaviour
  (e.g. a prop that is sometimes a string and sometimes a number) is
  typed as the honest union; the call sites are not "cleaned up" in the
  same commit.
