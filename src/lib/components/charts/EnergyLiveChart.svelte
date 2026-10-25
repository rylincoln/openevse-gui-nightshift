<script lang="ts">
  import { _, locale } from 'svelte-i18n'
  import type uPlot from 'uplot'
  import { config_store } from '../../stores/config'
  import UplotChart from './UplotChart.svelte'
  import { readChartTheme } from './chartTheme'
  import { panelOpts, PANEL_AXIS_SIZE } from './panels'
  import { socOrNull } from '../../dashboard/sessionChart'
  import { cToF } from '../../temperature'
  import type { EnergySample } from '../../api/device'

  interface Props {
    samples?: EnergySample[]
  }
  let { samples = [] }: Props = $props()

  // One panel per measure — current, temperature, state of charge — stacked
  // on a shared time axis, each with its own single axis. Hovering any panel
  // moves all three cursors, and each panel's title row reads out its value.
  const uid = $props.id()
  const syncKey = `energy-live-${uid}`

  // Samples always arrive in °C; the plotted series, its scale bounds and its
  // title all have to move together when the user prefers Fahrenheit.
  let isF = $derived(($config_store?.temp_unit ?? 'c') === 'f')
  let tempUnit = $derived($_(isF ? 'units.fahrenheit' : 'units.celsius'))

  // Only draw the SOC panel when a vehicle source actually reported it.
  let hasSoc = $derived(samples.some((s) => socOrNull(s) != null))

  let x = $derived(samples.map((s) => s.ts))
  let amps = $derived(samples.map((s) => s.a))
  // `> 0` is the no-reading sentinel and is tested against the raw °C value,
  // before any conversion -- in °F the same reading is a positive number.
  let temps = $derived(samples.map((s) => (s.t > 0 ? (isF ? cToF(s.t) : s.t) : null)))
  let socs = $derived(samples.map(socOrNull))

  // The sample under the cursor, or the newest one when the cursor is away.
  let cursorIdx = $state<number | null>(null)
  const track: uPlot.Plugin = {
    hooks: { setCursor: [(u: uPlot) => { cursorIdx = u.cursor.idx ?? null }] },
  }
  let idx = $derived(cursorIdx ?? samples.length - 1)
  let time = $derived(
    x[idx] != null
      ? new Date(x[idx] * 1000).toLocaleTimeString($locale || 'en', { hour: 'numeric', minute: '2-digit' })
      : '',
  )

  interface Panel {
    scale: string
    title: string
    values: (number | null)[]
    range: [number, number]
    fmt: (v: number) => string
  }

  let panels: Panel[] = $derived.by(() => {
    // Headroom that survives broken config: never below 40 A, always above the
    // highest observed sample. max_current_hard reports 0 on some firmware
    // builds (and the mock fixture), which would otherwise crush the trace.
    const hardCap = $config_store?.max_current_hard
    const peak = samples.length ? Math.max(...samples.map((s) => s.a ?? 0)) : 0
    const ampMax = Math.max(40, peak + 5, (hardCap || 0) + 5)
    const round1 = (v: number) => String(Math.round(v * 10) / 10)
    return [
      { scale: 'a', title: $_('monitoring.energy.axis.current'), values: amps, range: [0, ampMax], fmt: (v) => `${round1(v)} A` },
      {
        scale: 't',
        title: $_('monitoring.energy.axis.temperature', { values: { unit: tempUnit } }),
        values: temps,
        // −20…80 °C, in whichever unit is shown.
        range: isF ? [-4, 176] : [-20, 80],
        fmt: (v) => `${round1(v)} ${tempUnit}`,
      },
      ...(hasSoc
        ? [{ scale: 'soc', title: $_('monitoring.energy.axis.soc'), values: socs, range: [0, 100] as [number, number], fmt: (v: number) => `${Math.round(v)}%` }]
        : []),
    ]
  })

  // Opts depend only on the panel layout and units, not the samples, so the
  // 10 s poll takes UplotChart's cheap setData path.
  let optsByScale = $derived.by(() => {
    const theme = readChartTheme()
    const last = panels.length - 1
    return panels.map((p, i) =>
      panelOpts(theme, {
        scale: p.scale,
        label: p.title,
        range: p.range,
        syncKey,
        showX: i === last,
        xTime: true,
        plugins: [track],
      }),
    )
  })

  function finite(vs: (number | null)[]): number[] {
    return vs.filter((v): v is number => v != null && Number.isFinite(v))
  }

  // The canvases say nothing to a screen reader; this says what they show.
  let summary = $derived(
    panels
      .map((p) => {
        const vs = finite(p.values)
        if (!vs.length) return ''
        const values = {
          measure: p.title,
          min: p.fmt(Math.min(...vs)),
          max: p.fmt(Math.max(...vs)),
          latest: p.fmt(vs[vs.length - 1]),
        }
        return $_('monitoring.energy.summary', { values })
      })
      .filter(Boolean)
      .join(' '),
  )
</script>

{#if samples.length === 0}
  <div class="py-12 text-center text-sm text-text-dim">{$_('monitoring.energy.no_samples')}</div>
{:else}
  <figure class="flex h-full flex-col">
    <div class="text-right text-xs tabular-nums text-text-dim" aria-hidden="true">{time}</div>
    {#each panels as p, i (p.scale)}
      {@const v = p.values[idx]}
      <div
        class="flex items-baseline justify-between gap-2 text-xs {i ? 'mt-2' : ''}"
        style:padding-left="{PANEL_AXIS_SIZE}px"
      >
        <span class="text-text-dim">{p.title}</span>
        <span class="font-semibold tabular-nums text-text">{v != null ? p.fmt(v) : '—'}</span>
      </div>
      <div class="min-h-0 flex-1">
        <UplotChart opts={optsByScale[i]} data={[x, p.values]} fill />
      </div>
    {/each}
    <figcaption class="sr-only">{summary}</figcaption>
  </figure>
{/if}
