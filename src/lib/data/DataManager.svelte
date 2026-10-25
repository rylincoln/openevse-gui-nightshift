<script lang="ts">
  import { derived, get } from 'svelte/store'
  import { limit_store } from '../stores/limit'
  import { boost_store } from '../stores/boost'
  import { notification_store } from '../stores/notifications'
  import { badgeSignature } from '../notifications/notifications'
  import { uisettings_store } from '../stores/uisettings'
  import { uistates_store } from '../stores/uistates'
  import { status_store } from '../stores/status'
  import { schedule_store } from '../stores/schedule'
  import { plan_store } from '../stores/plan'
  import { config_store } from '../stores/config'
  import { claims_target_store } from '../stores/claims_target'
  import { claims_store } from '../stores/claims'
  import { override_store } from '../stores/override'
  import { formatDate } from '../utils'
  import { versionedResources } from './versioned'
  import type { Status } from '../api/device'
  import { locale, locales } from 'svelte-i18n'
  import { _ } from 'svelte-i18n'

  // setTimeout instances (actually set with setInterval below; same handle
  // type as setTimeout in both the DOM and Node lib typings)
  let counter_divert_update: ReturnType<typeof setTimeout> | undefined
  let counter_vehicle_update: ReturnType<typeof setTimeout> | undefined
  let counter_rfid_scan: ReturnType<typeof setTimeout> | undefined
  let counter_elapsed: ReturnType<typeof setTimeout> | undefined

  // derived stores replacing keyed stores (keyed stores do not trigger an update if the same value is published)
  const time = derived(status_store, ($s) => $s?.time)
  // Bumped by WebSocket.svelte on every frame that carries the advisory
  // object; part of the advisory list's version (see `notifications` below).
  const notification_event = derived(uistates_store, ($ui) => $ui?.notification_event ?? 0)
  const evse_state = derived(status_store, ($s) => $s?.state)
  const charging = derived(evse_state, ($s) => $s == 3 ? true : false)
  const rfid_waiting = derived(status_store, ($s) => $s?.rfid_waiting)
  const elapsed = derived(status_store, ($s) => $s?.session_elapsed)
  const ipaddress = derived(status_store, ($s) => $s?.ipaddress)

  let prev_ip: string | undefined
  let ip_changed = false

  // The stores the charger versions on /status, each re-downloaded when its
  // counter moves. A successful write never refreshes by hand: the charger
  // bumps the counter and the next frame brings it here.
  const versioned = versionedResources<Status, 'config' | 'schedule' | 'plan' | 'claims' | 'override' | 'limit' | 'boost' | 'notifications'>({
    config: { version: (s) => s.config_version, download: () => config_store.download() },
    schedule: { version: (s) => s.schedule_version, download: () => schedule_store.download() },
    plan: { version: (s) => s.schedule_plan_version, download: () => plan_store.download() },
    claims: {
      version: (s) => s.claims_version,
      // The claims list (with real per-claim priorities) changes in lockstep
      // with the target, so it rides on the same counter.
      download: async () => {
        const ok = await claims_target_store.download()
        await claims_store.download()
        return ok
      },
    },
    override: { version: (s) => s.override_version, download: () => override_store.download() },
    limit: {
      version: (s) => s.limit_version,
      // `limit` says whether one is set: with none there is nothing to fetch.
      download: (s) => (s.limit ? limit_store.download() : Promise.resolve(limit_store.reset())),
    },
    // No boost_version → firmware predates Boost; the store stays idle and
    // the whole surface hidden (capability gate). download() normalises {}
    // (idle) and {type,…} (active), so this covers arm / reached / cancelled /
    // replaced / reboot.
    boost: { version: (s) => s.boost_version, download: () => boost_store.download() },
    // Advisories have no counter of their own: /status carries the two badge
    // fields, and the firmware pushes them whenever the live set changes. The
    // pair alone is not enough — one advisory clearing as another of the same
    // severity is raised moves the set without moving either number — so the
    // frame-arrival nonce joins them. No `notifications` object → firmware
    // predates advisories: the bell, the strip and the settings markers stay
    // hidden. The gate is presence, never the values: a charger with nothing
    // to report still sends {count: 0, severity: "info"}.
    notifications: {
      version: (s) => {
        const sig = badgeSignature(s)
        return sig === null ? null : sig + '@' + get(notification_event)
      },
      download: () => notification_store.download(),
    },
  })
  // FetchData downloaded these as of the status still in the store: WebSocket
  // and DataManager mount only once it is done.
  if ($status_store) versioned.loaded(['config', 'schedule', 'plan', 'claims', 'override'], $status_store)

  export function refreshDateTime(t: string | undefined, tz: string | undefined): void { // params: time (isostring) , timezone
    // t is undefined only before status_store's first download; App.svelte
    // never mounts DataManager until FetchData.svelte has completed that
    // download (see src/lib/data/FetchData.svelte), so by the time this
    // effect can fire with a real frame, t is a string. formatDate's `t` is
    // untyped for undefined (utils.ts), so this asserts that invariant.
    $uistates_store.time_localestring = formatDate(t!, tz)
  }

  export function refreshChargingState(val: boolean): void {
    $uistates_store.charging = val
  }

  function countDivertUpdate(val: number | undefined): void {
    $uistates_store.divert_update = val
    clearInterval(counter_divert_update)
    counter_divert_update = setInterval(() => {
      // Number(undefined) + 1 === NaN, Number(n) + 1 === n + 1 — reproduces
      // the original `$uistates_store.divert_update++` exactly (undefined
      // on firmware without solar/divert mode) rather than substituting a
      // different seed value.
      $uistates_store.divert_update = Number($uistates_store.divert_update) + 1
    }, 1000);
  }

  function countVehicleUpdate(val: number | undefined): void {
    $uistates_store.vehicle_state_update = val
    clearInterval(counter_vehicle_update)
    counter_vehicle_update = setInterval(() => {
      // See countDivertUpdate: reproduces `x++` exactly via Number().
      $uistates_store.vehicle_state_update = Number($uistates_store.vehicle_state_update) + 1
    }, 1000);
  }

  function countRFIDScan(val: number | undefined): void {
    $uistates_store.rfid_waiting = val
    clearInterval(counter_rfid_scan)
    counter_rfid_scan = setInterval(() => {
      // See countDivertUpdate: reproduces `x--` exactly via Number().
      $uistates_store.rfid_waiting = Number($uistates_store.rfid_waiting) - 1
      if ($uistates_store.rfid_waiting == 0) {
        clearInterval(counter_rfid_scan)
      }
    }, 1000);
  }

  function countElapsed(val: number | undefined, charging: boolean): void {
    $uistates_store.elapsed = val
    clearInterval(counter_elapsed)
    if (charging) {
      counter_elapsed = setInterval(() => {
        // See countDivertUpdate: reproduces `x++` exactly via Number() (dead
        // in practice — val is undefined only before status_store's first
        // download, and DataManager never mounts that early).
        $uistates_store.elapsed = Number($uistates_store.elapsed) + 1
      }, 1000);
    }
  }

  function refreshLocale(lang: string | undefined): void {
    // The device reports its configured language; an empty string means
    // "no preference". Only adopt a language this build actually ships —
    // setting an empty/unbundled locale breaks message formatting.
    if (!lang || !$locales.includes(lang)) return
    if ($locale !== lang) {
      $locale = lang
      uisettings_store.set({ ...$uisettings_store, lang: $locale })
    }
  }

  async function redirect2ip(ip: string | undefined): Promise<void> {
    if (ip != prev_ip) {
      if (ip && ip != "192.168.4.1" && prev_ip) {
        uistates_store.resetAlertBox()
        $uistates_store.alertbox.visible = true
        $uistates_store.alertbox.title = $_("notification")
        $uistates_store.alertbox.body = $_("config.network.con-ok") + ip
        $uistates_store.alertbox.button = true
        $uistates_store.alertbox.closable = false
        $uistates_store.alertbox.action = () => { window.location.href = "http://" + ip + "/" + (window.location.hash || "#/") }
      }
      prev_ip = ip
      ip_changed = true
    }
  }

  function setErrorState(evseState: number | undefined): void {
    if (evseState !== undefined && evseState >= 4 && evseState <= 11) {
      // error state
      $uistates_store.error = true
    }
    else $uistates_store.error = false
  }

  // Every status frame, and every advisory arrival, goes to the versioned stores.
  $effect(() => {
    void $notification_event
    if ($status_store) versioned.observe($status_store)
  })
  $effect(() => { refreshDateTime($time, $config_store?.time_zone) })
  $effect(() => { refreshChargingState($charging) })
  $effect(() => { refreshLocale($config_store?.lang) })
  $effect(() => { countDivertUpdate($status_store?.divert_update) })
  $effect(() => { countVehicleUpdate($status_store?.vehicle_state_update) })
  $effect(() => { countRFIDScan($rfid_waiting) })
  $effect(() => { countElapsed($elapsed, $charging) })
  $effect(() => { redirect2ip($ipaddress) })
  $effect(() => { setErrorState($evse_state) })
</script>
