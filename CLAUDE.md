# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

The rules in `AGENTS.md` above are the project's own (shared with other agents
and the upstream firmware repo). The rest of this file adds what they leave
out: how the pieces fit together across files.

## Commands

pnpm only — the exact version is pinned in `package.json` (`packageManager`),
and pnpm's own settings (`allowBuilds`, `overrides`) live in
`pnpm-workspace.yaml`, not in `package.json`.

```bash
pnpm test src/lib/__tests__/queue.test.js        # one file (any path substring works)
pnpm test src/lib/config -t "inclusive"           # one test by name pattern
pnpm test:coverage                                # coverage is scoped to src/lib/**/*.js
node scripts/screenshots.mjs --only dashboard-charging,settings   # a subset of the manifest
node scripts/build-locale-values.mjs              # regenerate es/fr/hu.json on demand
```

Screenshots need Playwright Chromium once: `pnpm exec playwright install chromium`.

## How data flows

The app is a pure client of the device's HTTP + WebSocket API. Three
components mounted by `src/App.svelte` own the whole data layer
(`src/lib/data/`):

1. **`FetchData.svelte`** — boot. Downloads eight stores in sequence
   (status → schedule → plan → config → override → claims_target → claims →
   certificates); any failure shows the reconnect alert. Then `App.svelte`
   gates on `config.wizard_passed` (first-run wizard) before rendering
   `AppShell`. `/login` renders standalone above this gate because a 401
   blocks the config fetch.
2. **`WebSocket.svelte`** — live. Every frame from `/ws` is merged into
   `status_store`. Reconnect with exponential backoff; ping keepalive;
   torn down and rebuilt on `online`/`visibilitychange` because iOS returns
   "OPEN but dead" sockets.
3. **`DataManager.svelte`** — the **version counter** loop. `/status` carries
   `config_version`, `schedule_version`, `override_version`, `limit_version`,
   `boost_version`, … Each has a derived store, a `refreshXStore(ver)` that
   re-downloads the matching store through `serialQueue` when the counter
   moves, and an `$effect` wiring them. **A successful write never refreshes
   manually** — the device bumps the counter, the WS frame carries it, and
   DataManager re-downloads. Adding a versioned resource means adding all
   three pieces here plus a store with `download()`.

**Capability gate**: a field *absent* from `/status` (`boost_version`,
`notifications`, `limit`) means the firmware predates that feature — leave the
store idle and the UI hidden. Gate on presence, never on values.

**Stores** (`src/lib/stores/*.js`) wrap a `writable` with `download()` → boolean
and usually `upload()`. All HTTP goes through `src/lib/api/httpAPI.js`: in dev
it prefixes `/api` (which Vite proxies or the mock plugin serves), returns the
string `'error'` on failure, and redirects to `/login` on 401.

## Config pages

Every `src/routes/settings/*.svelte` follows one pattern
(`Emoncms.svelte` is the smallest example):

- `createConfigForm()` from `src/lib/config/configForm.svelte.js` gives
  `saveField(name, value)` / `saveFields({...})`, a `saveState` store
  (`'saving' | 'saved' | 'error'` per field, fed to `<FormField status>`), and a
  `revert` counter that bumps on failure so controlled inputs resync to the
  store's confirmed value. Pass `revert={form.revert}` to every input.
- Save is per field on change; the write is `config_store.upload` → `POST /config`,
  success is `msg: "done" | "no change"`. Failure calls `showWriteError()`
  (`src/lib/alerts.js`) — the one global write-failure alert; reuse it.
- Layout: `ConfigPage > ConfigSection > FormField > ui primitive`
  (`src/lib/components/config/`, `src/lib/components/ui/`).
- Modules that use runes outside a component are named `*.svelte.js`.

## Routing and the settings catalogue

Hash routing, exact match, no params (`src/lib/router.js`,
`src/lib/components/Router.svelte`). `routes.js` also holds `LEGACY_ROUTES`
(old `/configuration/*` hashes → `/settings/*`) so firmware upgrades don't 404
bookmarks. `SETTINGS_PAGES` in `src/lib/config/pages.js` gates pages by
`requires` (a `/config` key that must be present) or `labs` (the client-side
OpenEVSE Labs switch, `uisettings.dev_features`).

Adding a settings page touches: `pages.js`, `routes.js` (override the
placeholder), `config.pages.<key>` in every i18n catalog, and
`scripts/screenshots.config.js`.

## Styling

Tailwind theme tokens only — `bg-surface`, `bg-surface-2`, `bg-surface-3`,
`text-text`, `text-text-dim`, `text-accent`, `border-border`, `text-charging`,
`text-error`, `text-warning`, `text-sleep`, `text-success` — defined in
`src/app.css` `@theme` and driven by `[data-theme="light"|"dark"]`; the `dark:`
variant is remapped onto that attribute. Svelte 5 runes throughout.

## Tests

Vitest + jsdom + `@testing-library/svelte`; tests live in `__tests__/` beside
the code. `src/test-setup.js` stubs `iconify-icon`, `matchMedia`,
`ResizeObserver` and `localStorage`. Every component test mocks i18n the same
way:

```js
vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})
```

`vi.mock()` targets must exist on disk (Vite 8 resolves them).
`src/lib/i18n/__tests__/locale-parity.test.js` fails the suite when a key is
missing from any `source/` catalog or a `{placeholder}` differs from `en`.

## Device facts

`/status` units: `amp` is milliamps, `power` is watts, `session_energy` is Wh,
`temp*` are tenths of °C (`temp_round` in `utils.js`); `total_energy`,
`total_day` are already kWh. EVSE `state`: 1 idle, 2 connected, 3 charging,
4–11 fault, 254 sleeping, 255 off.

`docs/superpowers/specs/` and `plans/` hold the design spec and plan behind
each feature — read the matching pair before extending a screen. The two
`*-RUNBOOK.md` files there are historical.
