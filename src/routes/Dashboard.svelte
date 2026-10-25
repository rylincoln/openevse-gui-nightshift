<script lang="ts">
  import { _, locale } from 'svelte-i18n'
  import { fade } from 'svelte/transition'
  import { status_store } from '../lib/stores/status'
  import { config_store } from '../lib/stores/config'
  import { override_store } from '../lib/stores/override'
  import { limit_store } from '../lib/stores/limit'
  import { boost_store } from '../lib/stores/boost'
  import { claims_target_store } from '../lib/stores/claims_target'
  import { plan_store } from '../lib/stores/plan'
  import { energy_store } from '../lib/stores/energy'
  import { uisettings_store } from '../lib/stores/uisettings'
  import { loadsharing_store } from '../lib/stores/loadsharing'
  import { httpAPI, accepted } from '../lib/api/httpAPI'
  import { EvseClients } from '../lib/vars'
  import { sec2time, temp_round, round, clientid2name, hardMaxCurrent } from '../lib/utils'
  import { formatTemp } from '../lib/temperature'
  import { formatCost } from '../lib/cost'
  import { showWriteError, showBoostError } from '../lib/alerts'
  import { displayState, ringFill, maxPowerW, vehicleConnected } from '../lib/dashboard/state'
  import { chargerStatus } from '../lib/dashboard/status'
  import { boostTarget } from '../lib/dashboard/boost'
  import { rateCap } from '../lib/dashboard/rate'
  import { formatClock } from '../lib/format/clock'
  import { socCeiling, estMaxRange, hmsShort } from '../lib/dashboard/soc'
  import { loadSharingView } from '../lib/dashboard/loadsharing'
  import { createWriteRunner } from '../lib/dashboard/writes'

  import StatusLine from '../lib/components/dashboard/StatusLine.svelte'
  import PowerRing from '../lib/components/dashboard/PowerRing.svelte'
  import ChargingHero from '../lib/components/dashboard/ChargingHero.svelte'
  import StatChips from '../lib/components/dashboard/StatChips.svelte'
  import ShaperDivertRow from '../lib/components/dashboard/ShaperDivertRow.svelte'
  import LoadSharingCard from '../lib/components/dashboard/LoadSharingCard.svelte'
  import ThrottleBadge from '../lib/components/dashboard/ThrottleBadge.svelte'
  import {
    readChargeMode,
    selectChargeMode,
    setChargeRate,
    type ChargeModeCharger,
    type ChargeModeSnapshot,
    type ControlSegment,
  } from '../lib/dashboard/chargeMode'
  import ChargeControls from '../lib/components/dashboard/ChargeControls.svelte'
  import BoostCard from '../lib/components/dashboard/BoostCard.svelte'
  import RatePill from '../lib/components/dashboard/RatePill.svelte'
  import ChargeLimitCard from '../lib/components/dashboard/ChargeLimitCard.svelte'
  import AdvisoryStrip from '../lib/components/notifications/AdvisoryStrip.svelte'
  import type { Limit, LimitType } from '../lib/api/device'

  // Controls stay enabled while a write is in flight (disabling a focused
  // control drops keyboard focus); input made meanwhile is held, latest per
  // control, and written once the current write finishes.
  const writes = createWriteRunner()
  let rateNonce = $state(0)

  // ── derived view-model ──────────────────────────────────────────────────
  let minAmps = $derived($config_store?.min_current_hard ?? 6)
  // Rate pill slider stops at the configured soft max (Settings > Charger), so
  // the home page can't request — or display — more current than the user has
  // allowed. Falls back to the hardware ceiling when the soft max is unset —
  // and past a hardware ceiling the firmware has not read yet (0), which
  // would otherwise pin the pill at 0 A (see hardMaxCurrent).
  let maxAmps = $derived(
    Math.min($config_store?.max_current_soft ?? Infinity, hardMaxCurrent($config_store, 48)),
  )
  let defaultAmps = $derived($config_store?.max_current_soft ?? maxAmps)

  // The charge mode, who owns the decision, and whether it can be changed.
  let modeSnapshot: ChargeModeSnapshot = $derived({
    claimsTarget: $claims_target_store,
    divertmode: $status_store?.divertmode,
    divertEnabled: !!$config_store?.divert_enabled,
    override: $override_store,
    limit: $limit_store,
    defaultRate: defaultAmps,
  })
  let chargeMode = $derived(readChargeMode(modeSnapshot))
  let display = $derived(displayState($status_store, chargeMode.segment))
  let charging = $derived(display === 'charging')
  // Is a car physically plugged in? Prefers the firmware `vehicle` flag, which
  // stays accurate through Sleeping/Off where the state code alone can't tell.
  let connected = $derived(vehicleConnected($status_store))
  // While charging, show the session chart hero (it polls /energy/raw); every
  // other state keeps the PowerRing.
  let showChart = $derived(charging)
  let fill = $derived(ringFill($status_store, $config_store, $limit_store))

  let socRangeLimit = $derived($limit_store?.type === 'soc' || $limit_store?.type === 'range')

  // A default limit applied by the firmware (config limit_default_*) reports
  // auto_release: false on /limit — it's config-driven, so the dashboard
  // shows it but offers no way to delete it.
  let systemLimit = $derived($limit_store?.auto_release === false)

  let kw = $derived((($status_store?.power ?? 0) / 1000).toFixed(1))
  // Shown on the PowerRing while charging (the non-Labs / chart-off path).
  // maxPowerW handles the 3-phase ×3 so this label matches the ring fill.
  let maxKw = $derived((maxPowerW($status_store, $config_store) / 1000).toFixed(1))

  let tempDisplay = $derived(
    formatTemp(temp_round($status_store?.temp), $config_store?.temp_unit ?? 'c'),
  )
  let live = $derived({
    sessionKwh: (($status_store?.session_energy ?? 0) / 1000).toFixed(2),
    elapsed: sec2time($status_store?.session_elapsed ?? 0),
    currentA: (($status_store?.amp ?? 0) / 1000).toFixed(1),
    temp: tempDisplay.value,
    tempUnit: tempDisplay.unitKey,
    // Vehicle charge ETA (MQTT topic) — '' when the topic isn't configured.
    toFull: hmsShort($status_store?.time_to_full_charge ?? 0),
  })
  let summary = $derived({
    todayKwh: round($status_store?.total_day ?? 0, 1),
    totalKwh: round($status_store?.total_energy ?? 0, 0),
  })
  let sessionCost = $derived(
    formatCost(
      ($status_store?.session_energy ?? 0) / 1000,
      $uisettings_store?.energy_rate,
      $uisettings_store?.currency_symbol,
    ),
  )

  let chargeAmps = $derived(
    $claims_target_store?.properties?.charge_current
      ? Math.min($claims_target_store.properties.charge_current, maxAmps)
      : defaultAmps,
  )
  let rateClaimedBy = $derived(
    $claims_target_store?.claims?.charge_current &&
    $claims_target_store.claims.charge_current !== EvseClients.manual.id
      ? $_(`clients.${clientid2name($claims_target_store.claims.charge_current)}`)
      : '',
  )
  // A client capping the current below the charge rate (load shaper, load
  // sharing): named in the status line and in the rate control, so a pilot
  // below the chosen rate never goes unexplained.
  let cap = $derived.by(() => {
    const c = rateCap($claims_target_store, chargeAmps)
    return c
      ? { key: 'dashboard.line.cap', values: { client: $_(`clients.${c.client}`), amps: String(c.amps) } }
      : null
  })
  let capText = $derived(cap ? $_(cap.key, { values: cap.values }) : '')
  // The status line names the cap only while power could flow; paused or
  // off, it is beside the point.
  let statusCap = $derived(charging || display === 'connected' ? cap : null)
  // Load sharing is Labs-gated (see the OpenEVSE Labs switch on Settings →
  // Terminal). Even when the device reports it enabled, the dashboard block
  // stays hidden until the user opts into Labs features.
  let loadSharingVisible = $derived(
    !!$config_store?.loadsharing_enabled && !!$config_store?.labs_enabled,
  )
  // failsafe_active and the controller's last_seen live on GET
  // /loadsharing/status, not on the websocket; the firmware ticks
  // loadsharing_status_version when either changes, so fetch on the tick —
  // the same trigger Settings → Load sharing uses.
  $effect(() => {
    const version = $status_store?.loadsharing_status_version
    if (loadSharingVisible && version !== undefined) loadsharing_store.downloadStatus()
  })
  let loadSharing = $derived(
    loadSharingVisible
      ? loadSharingView({
          config: $config_store,
          status: $status_store,
          claimsTarget: $claims_target_store,
          lsStatus: $loadsharing_store?.status ?? null,
          localMax: maxAmps,
        })
      : null,
  )
  let currentLimited = $derived(loadSharing !== null && loadSharing.state !== 'sharing')

  // Eco: solar divert sets the charge rate, so the rate control stands aside.
  let ecoOn = $derived(chargeMode.segment === 'eco')

  function formatLimit(l: Limit | null | undefined): string {
    if (!l || !l.type || l.type === 'none') return ''
    if (l.type === 'time') return sec2time(l.value * 60)
    if (l.type === 'energy') return `${round(l.value / 1000, 1)} kWh`
    if (l.type === 'soc') return `${l.value}%`
    if (l.type === 'range') return `${l.value} km`
    return ''
  }


  // ── charge-limit bar view-model ─────────────────────────────────────────
  let hasSoc = $derived(
    $status_store?.battery_level !== undefined && $status_store?.battery_level !== null,
  )
  let vehicleLimit = $derived(
    typeof $status_store?.vehicle_charge_limit === 'number' &&
      Number.isFinite($status_store.vehicle_charge_limit)
      ? $status_store.vehicle_charge_limit
      : null,
  )
  let maxRange = $derived(estMaxRange($status_store?.battery_range, $status_store?.battery_level))
  // The bar owns soc + range limits; the row owns time + energy.
  let barLimitActive = $derived(socRangeLimit)
  // Display unit: follows the active range limit by default; the toggle overrides.
  let userUnit = $state<'percent' | 'range' | null>(null)
  let limitUnit = $derived(userUnit ?? ($limit_store?.type === 'range' ? 'range' : 'percent'))
  // Knob position is always a percent. Map the active limit back to a percent.
  let socTarget = $derived(
    $limit_store?.type === 'soc'
      ? $limit_store.value
      : $limit_store?.type === 'range' && maxRange !== null
        ? // clamp: a stale range limit above a shrunken max-range estimate must
          // not map past 100% (the knob would then auto-clear on first touch)
          Math.round(Math.min(100, ($limit_store.value / maxRange) * 100))
        : socCeiling(vehicleLimit),
  )
  // Bumped on a failed bar write to remount the card back to the confirmed value.
  let socNonce = $state(0)

  // ── actions ─────────────────────────────────────────────────────────────
  // The charge mode's charger seam.
  const charger: ChargeModeCharger = {
    setOverride: (o) => override_store.upload(o),
    clearOverride: () => override_store.clear(),
    setDivertMode: async (dm) => accepted(await httpAPI('POST', '/divertmode', `divertmode=${dm}`, 'text')),
    clearLimit: () => limit_store.remove(),
  }

  function setSegment(seg: ControlSegment): Promise<void> {
    return writes.run('mode', async () => {
      if (!(await selectChargeMode(seg, modeSnapshot, charger))) showWriteError()
    })
  }

  function setChargeAmps(val: number): Promise<void> {
    return writes.run('rate', async () => {
      if (!(await setChargeRate(val, modeSnapshot, charger))) {
        showWriteError()
        rateNonce++ // remount RatePill so the slider reverts to the confirmed value
      }
    })
  }


  // Inline editors commit device-unit values; 0 means clear. A system limit
  // is never DELETEd from here — snap the card back instead (shipped rule).
  function setInlineLimit({ type, value }: { type: LimitType; value: number }): Promise<void> {
    return writes.run('limit', async () => {
      if (!value) {
        if (systemLimit) {
          socNonce++
          return
        }
        return clearLimit()
      }
      const ok = await limit_store.upload({ type, value, auto_release: true })
      if (ok) {
        await limit_store.download()
      } else {
        showWriteError()
        socNonce++
      }
    })
  }

  async function clearLimit(): Promise<void> {
    const ok = await limit_store.remove()
    if (!ok) {
      showWriteError()
      socNonce++ // remount the card so a dragged-to-zero knob reverts
    }
  }

  // Snap-to-clear: a knob at/above the vehicle limit means "no limit". Below it,
  // write a soc or range limit depending on the active display unit.
  function setTarget(pct: number): Promise<void> {
    return writes.run('limit', async () => {
      let ok
      if (pct >= socCeiling(vehicleLimit)) {
        if (barLimitActive && systemLimit) {
          // A system (default) limit can't be cleared from the bar — snap the
          // knob back to the configured limit instead of deleting it.
          socNonce++
          ok = true
        } else {
          ok = barLimitActive ? await limit_store.remove() : true
        }
      } else {
        const data: Limit =
          limitUnit === 'range' && maxRange !== null
            ? { type: 'range', value: Math.round((pct / 100) * maxRange), auto_release: true }
            : { type: 'soc', value: pct, auto_release: true }
        ok = await limit_store.upload(data)
        if (ok) await limit_store.download()
      }
      if (!ok) {
        showWriteError()
        socNonce++ // remount the card so the knob reverts to the confirmed value
      }
    })
  }

  // Boost: a device-side claim (priority 200) that charges NOW until a chosen
  // target — time / energy / soc / range — is reached, then releases so the
  // scheduler or solar-divert resume. The firmware owns the claim and the
  // countdown; the UI only arms (POST /boost), cancels (DELETE /boost) and
  // mirrors GET /boost. This replaces the old client-timer/override hack, so
  // the boost path no longer touches /override or /limit at all.
  //
  // Capability gate: supporting firmware ships boost_version in /status; older
  // firmware omits it, and the whole Boost surface stays hidden.
  let boostSupported = $derived(
    $status_store?.boost_version !== undefined && $status_store?.boost_version !== null,
  )
  // Normalised idle sentinel is type 'none'; anything else is a live boost.
  let activeBoost = $derived(
    $boost_store?.type && $boost_store.type !== 'none' ? $boost_store : null,
  )
  // What the charger is doing and why: one line above either hero.
  let status = $derived(
    chargerStatus({
      display,
      segment: chargeMode.segment,
      stateOwner: chargeMode.owner,
      vehicle: connected,
      fault: $status_store?.state,
      plan: $plan_store,
      limitText: formatLimit($limit_store),
      boostText: boostTarget(activeBoost, $_, $_($config_store?.mqtt_vehicle_range_miles ? 'units.miles' : 'units.km')),
      time: (t) => formatClock(t, $locale),
      clientName: (k) => $_(`clients.${k}`),
    }),
  )
  // Read out on change only: no live numbers in it, so it stays quiet while
  // charging and speaks when the state or the reason moves.
  let statusSpoken = $derived(
    [status.headline, status.plug, status.reason, status.next, statusCap]
      .filter((r) => r !== null)
      .map((r) => $_(r.key, { values: r.values }))
      .join('. '),
  )

  // soc/range dimensions need a vehicle data source — same gates the limit card
  // uses. Hidden (not just disabled) when absent; the 422 backstop still runs.
  let canRange = $derived(hasSoc && Number.isFinite(maxRange))

  function armBoost({ type, value }: { type: LimitType; value: number }): Promise<void> {
    return writes.run('boost', async () => {
      const res = await boost_store.upload({ type, value })
      if (res.ok) {
        // Reconcile from the device rather than trusting the 201: an
        // already-met soc/range target also returns 201 but leaves nothing
        // running, so flipping to "active" here would show a ghost boost.
        await boost_store.download()
      } else if (res.reason) {
        showBoostError(res.reason) // 422 (no vehicle source) / 400 (bad value)
      } else {
        showWriteError() // the charger could not be reached
      }
    })
  }

  function cancelBoost(): Promise<void> {
    return writes.run('boost', async () => {
      await boost_store.remove()
      await boost_store.download()
    })
  }

  // While charging, refresh the raw energy log every 10 s so the session chart
  // tracks live. The raw log isn't version-bumped like the pull stores, so we
  // poll it ourselves. The effect re-runs when `charging` flips; its cleanup
  // clears the interval, so polling starts/stops with the charging state. The
  // in-flight guard prevents ticks piling up if the device is slow to respond.
  $effect(() => {
    if (!showChart) return
    let inflight = false
    const tick = async () => {
      if (inflight) return
      inflight = true
      try {
        await energy_store.loadRaw()
      } finally {
        inflight = false
      }
    }
    tick()
    const id = setInterval(tick, 10000)
    return () => clearInterval(id)
  })

</script>

<section
  class="flex flex-col px-4 pb-4 lg:mx-auto lg:grid lg:w-full lg:max-w-5xl
         lg:grid-cols-2 lg:items-start lg:gap-x-6"
>
  <!-- The status line is the visible headline; this gives the page outline
       the top level every other screen has. -->
  <h1 class="sr-only">{$_('nav.home')}</h1>
  <!-- Above the hero in both layouts: no `order`, so it precedes the
       order-1 hero on mobile, and it spans the desktop grid. Renders nothing
       unless there is an unmuted critical advisory. -->
  <div class="lg:col-span-2"><AdvisoryStrip /></div>
  <p class="sr-only" role="status">{statusSpoken}</p>

  {#if showChart}
    <!-- Labs chart hero: full content width on desktop, first block on mobile -->
    <div class="max-lg:order-1 lg:col-span-2" in:fade={{ duration: 150 }}>
      <ChargingHero
        {kw}
        soc={hasSoc ? ($status_store?.battery_level ?? null) : null}
        target={socTarget}
        {hasSoc}
        amps={chargeAmps}
        {minAmps}
        {maxAmps}
        {rateClaimedBy}
        {capText}
        cap={statusCap}
        {rateNonce}
        samples={$energy_store.raw.samples}
        voltage={$status_store?.voltage ?? 0}
        phases={$config_store?.is_threephase ? 3 : 1}
        sessionElapsed={$status_store?.session_elapsed ?? 0}
        chartError={$energy_store.error.raw}
        rateDisabled={ecoOn || display === 'error'}
        {status}
        onrate={setChargeAmps}
      />
    </div>
  {/if}

  {#if !showChart}
    <!-- Ring hero: occupies the same top-center spanning slot as the chart,
         so the hero area matches between the two states. On mobile the pills
         flow in a row above the ring (a narrow ring would otherwise collide
         with them); on desktop the hero is wide, so the wrapper dissolves
         (lg:contents) and the pills mirror each other across the ring's top
         corners. -->
    <div class="relative max-lg:order-1 lg:col-span-2" in:fade={{ duration: 150 }}>
      <div class="flex items-start justify-between gap-2 px-1 pb-2 lg:contents">
        <div class="min-w-0 lg:absolute lg:left-3 lg:top-1 lg:z-10 lg:max-w-[40%]"><StatusLine {status} cap={statusCap} /></div>
        <div class="shrink-0 lg:absolute lg:right-3 lg:top-1 lg:z-10">
          {#key rateNonce}
            <RatePill
              amps={chargeAmps}
              min={minAmps}
              max={maxAmps}
              claimedBy={rateClaimedBy}
              {capText}
              disabled={ecoOn || display === 'error'}
              onchange={setChargeAmps}
            />
          {/key}
        </div>
      </div>
      <PowerRing
        {display}
        {fill}
        {kw}
        maxKw={charging ? maxKw : ''}
      />
    </div>
  {/if}

  <!-- Act column: throttle, mode controls.
       max-lg:contents dissolves the wrapper on mobile, where max-lg:order-*
       sets a phone's reading order: status (hero), then the controls that
       change it (mode, boost, charge limit), then the readouts. -->
  <div class="max-lg:contents lg:flex lg:flex-col">
    <div class="max-lg:order-2"><ThrottleBadge /></div>

    <!-- Segmented mode control. Stays visible (disabled) during a fault so the
         layout doesn't reflow. -->
    <div class="max-lg:order-3">
      <ChargeControls
        segment={chargeMode.segment}
        divertEnabled={modeSnapshot.divertEnabled}
        locked={chargeMode.locked !== null}
        lockLabel={chargeMode.locked ?? ''}
        disabled={display === 'error'}
        onsegment={setSegment}
      />

      <!-- Boost: a device-side charge-until-target action. Hidden entirely on
           firmware that doesn't advertise the capability (no boost_version). -->
      {#if boostSupported}
        <BoostCard
          active={activeBoost}
          {hasSoc}
          {canRange}
          soc={$status_store?.battery_level ?? 0}
          range={$status_store?.battery_range ?? null}
          estMaxRange={maxRange}
          rangeMiles={!!$config_store?.mqtt_vehicle_range_miles}
          maxEnergyKwh={$uisettings_store?.max_energy_kwh ?? 100}
          disabled={chargeMode.locked !== null || display === 'error'}
          onarm={armBoost}
          oncancel={cancelBoost}
        />
      {/if}
    </div>
  </div>

  <!-- Observe column: stat chips -->
  <div class="max-lg:contents lg:flex lg:flex-col">
    <div class="max-lg:order-5">
      <StatChips {charging} {live} {summary} {sessionCost} {currentLimited} />
      <ShaperDivertRow />
      {#if loadSharing}
        <LoadSharingCard view={loadSharing} />
      {/if}
    </div>
  </div>

  <!-- SOC / charge-limit card: full content width on desktop, below the columns -->
  {#if display !== 'error'}
    <div class="max-lg:order-4 lg:col-span-2">
      {#key socNonce}
        <ChargeLimitCard
          {hasSoc}
          soc={$status_store?.battery_level ?? 0}
          {vehicleLimit}
          target={socTarget}
          range={$status_store?.battery_range ?? null}
          rangeMiles={!!$config_store?.mqtt_vehicle_range_miles}
          timeToFull={$status_store?.time_to_full_charge ?? 0}
          {charging}
          estMaxRange={maxRange}
          ontarget={setTarget}
          onunit={(u) => (userUnit = u)}
          limit={$limit_store}
          elapsedSec={$status_store?.session_elapsed ?? 0}
          sessionWh={$status_store?.session_energy ?? 0}
          {systemLimit}
          maxEnergyKwh={$uisettings_store?.max_energy_kwh ?? 100}
          onlimit={setInlineLimit}
        />
      {/key}
    </div>
  {/if}
</section>
