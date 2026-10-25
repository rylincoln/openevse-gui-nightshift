<script lang="ts">
  import { _ } from 'svelte-i18n'
  import UplotChart from '../charts/UplotChart.svelte'
  import { readChartTheme } from '../charts/chartTheme'
  import { PANEL_AXIS_SIZE } from '../charts/panels'
  import {
    clipToSession,
    toChartData,
    kwAxisMax,
    buildSocOpts,
    buildKwOpts,
  } from '../../dashboard/sessionChart'
  import type { EnergySample } from '../../api/device'

  interface Props {
    samples?: EnergySample[]
    voltage?: number
    target?: number | null
    sessionElapsed?: number
    phases?: 1 | 3
  }
  let { samples = [], voltage = 0, target = null, sessionElapsed = 0, phases = 1 }: Props = $props()

  // Two panels on one time axis — state of charge, then power — rather than
  // one plot with a second y-axis. Hovering either moves both cursors.
  const uid = $props.id()
  const syncKey = `session-${uid}`

  // Size the chart to the viewport so it grows on taller windows: ~33% of the
  // window height, clamped to 130–420px, shared between the panels. Passed
  // straight to uPlot as pixel heights (more reliable than a percentage-height
  // /flex chain, which doesn't resolve through the dashboard's flex layout).
  let winH = $state(0)
  let height = $derived(Math.round(Math.min(420, Math.max(130, winH * 0.33))))

  let clipped = $derived(clipToSession(samples, sessionElapsed))
  let data = $derived(toChartData(clipped, voltage, phases)) // [x, soc, kw]
  let hasSoc = $derived(data[1].some((v) => v != null))
  let socH = $derived(hasSoc ? Math.max(80, Math.round(height * 0.58)) : 0)
  let kwH = $derived(Math.max(70, height - socH))
  let socData = $derived([data[0], data[1]] as [number[], (number | null)[]])
  let kwData = $derived([data[0], data[2]] as [number[], (number | null)[]])

  // Keep kwMax (the power ceiling) as its own number-valued derived so it only
  // changes when the rounded peak changes. The opts then keep a stable
  // reference across the 10s data poll, so UplotChart takes the cheap setData
  // path instead of a full rebuild — a rebuild collapses the canvas for a frame
  // and makes iOS Safari jump the scroll position to the top on every redraw.
  let kwMax = $derived(kwAxisMax(data[2]))
  let socOpts = $derived.by(() =>
    buildSocOpts({
      theme: readChartTheme(),
      target,
      targetLabel: $_('dashboard.session.target', { values: { target } }),
      height: socH,
      syncKey,
    }),
  )
  let kwOpts = $derived.by(() => buildKwOpts({ theme: readChartTheme(), kwMax, height: kwH, syncKey }))

  // The canvas says nothing to a screen reader; this says what it shows.
  let summary = $derived.by(() => {
    const finite = (vs: (number | null)[]) => vs.filter((v): v is number => v != null && Number.isFinite(v))
    const socs = finite(data[1])
    const kws = finite(data[2])
    const parts: string[] = []
    if (socs.length) {
      const values = { from: socs[0], to: socs[socs.length - 1], target }
      parts.push($_(target != null ? 'dashboard.session.summary_soc' : 'dashboard.session.summary_soc_no_target', { values }))
    }
    if (kws.length) {
      const values = { peak: Math.max(...kws).toFixed(1), now: kws[kws.length - 1].toFixed(1) }
      parts.push($_('dashboard.session.summary_power', { values }))
    }
    return parts.join(' ')
  })
</script>

<svelte:window bind:innerHeight={winH} />

{#if clipped.length < 2}
  <div class="grid place-items-center text-sm text-text-dim" style="height: {height}px">
    {$_('dashboard.session.collecting')}
  </div>
{:else}
  <figure>
    {#if hasSoc}
      <div class="text-xs text-text-dim" style:padding-left="{PANEL_AXIS_SIZE}px">
        {$_('dashboard.session.soc_title')}
      </div>
      <UplotChart opts={socOpts} data={socData} />
    {/if}
    <div class="mt-1 text-xs text-text-dim" style:padding-left="{PANEL_AXIS_SIZE}px">
      {$_('dashboard.session.power_title')}
    </div>
    <UplotChart opts={kwOpts} data={kwData} />
    <figcaption class="sr-only">{summary}</figcaption>
  </figure>
{/if}
