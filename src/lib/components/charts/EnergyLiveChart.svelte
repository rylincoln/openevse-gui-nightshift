<script lang="ts">
  import { _ } from 'svelte-i18n'
  import type { ComponentProps } from 'svelte'
  import { config_store } from '../../stores/config'
  import UplotChart from './UplotChart.svelte'
  import { readChartTheme } from './chartTheme'
  import { socOrNull } from '../../dashboard/sessionChart'
  import { cToF } from '../../temperature'
  import type { EnergySample } from '../../api/device'

  interface Props {
    samples?: EnergySample[]
  }
  let { samples = [] }: Props = $props()

  // Samples always arrive in °C; the plotted series, its scale bounds and its
  // legend label all have to move together when the user prefers Fahrenheit.
  // Converting only the data would leave a °C axis range and a "°C" legend.
  let isF = $derived(($config_store?.temp_unit ?? 'c') === 'f')

  // Only draw the SOC axis/line when a vehicle source actually reported it,
  // so devices without vehicle integration don't get an empty green axis.
  let hasSoc = $derived(samples.some((s) => socOrNull(s) != null))

  // On a phone the chart can't afford a second right-hand axis: temperature
  // and SOC stacked there crush the plot. When narrow we keep the SOC line
  // (and its legend read-out) but drop its dedicated axis. Seed synchronously
  // so the first paint already has the right axes, then track viewport changes.
  const NARROW_MQ = '(max-width: 640px)'
  const matchesNarrow = () =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(NARROW_MQ).matches
      : false
  let narrow = $state(matchesNarrow())
  $effect(() => {
    const mq = window.matchMedia(NARROW_MQ)
    const sync = () => (narrow = mq.matches)
    sync()
    mq.addEventListener?.('change', sync)
    return () => mq.removeEventListener?.('change', sync)
  })

  let data: ComponentProps<typeof UplotChart>['data'] = $derived.by(() => {
    const x = samples.map((s) => s.ts)
    const a = samples.map((s) => s.a)
    // `> 0` is the no-reading sentinel and is tested against the raw °C value,
    // before any conversion -- in °F the same reading is a positive number.
    const t = samples.map((s) => (s.t > 0 ? (isF ? cToF(s.t) : s.t) : null))
    const base: [number[], number[], (number | null)[]] = [x, a, t]
    return hasSoc ? [...base, samples.map(socOrNull)] : base
  })

  let opts: ComponentProps<typeof UplotChart>['opts'] = $derived.by(() => {
    const theme = readChartTheme()
    // Headroom that survives broken config: never below 40 A, always above the
    // highest observed sample. max_current_hard reports 0 on some firmware
    // builds (and the mock fixture), which would otherwise crush the trace.
    const hardCap = $config_store?.max_current_hard
    const peak = samples.length ? Math.max(...samples.map((s) => s.a ?? 0)) : 0
    const ampMax = Math.max(40, peak + 5, (hardCap || 0) + 5)
    return {
      cursor: { drag: { x: false, y: false } },
      legend: { show: true },
      scales: {
        x: { time: true },
        a: { range: [0, ampMax] },
        t: { range: isF ? [cToF(-20), cToF(80)] : [-20, 80] },
        ...(hasSoc ? { soc: { range: [0, 100] } } : {}),
      },
      axes: [
        { stroke: theme.axisText, grid: { stroke: theme.grid, width: 1 } },
        { scale: 'a', label: $_('monitoring.energy.axis.current'), stroke: theme.charging, grid: { stroke: theme.grid, width: 1 } },
        { side: 1, scale: 't', label: $_('monitoring.energy.axis.temperature'), stroke: theme.warning, grid: { show: false } },
        ...(hasSoc && !narrow
          ? [{ side: 1, scale: 'soc', label: $_('monitoring.energy.axis.soc'), stroke: theme.success, grid: { show: false } }]
          : []),
      ],
      series: [
        {},
        { label: 'A', scale: 'a', stroke: theme.charging, width: 2, fill: theme.charging + '22' },
        { label: $_(isF ? 'units.fahrenheit' : 'units.celsius'), scale: 't', stroke: theme.warning, width: 2 },
        ...(hasSoc ? [{ label: 'SOC %', scale: 'soc', stroke: theme.success, width: 2 }] : []),
      ],
    }
  })
</script>

{#if samples.length === 0}
  <div class="py-12 text-center text-sm text-text-dim">{$_('monitoring.energy.no_samples')}</div>
{:else}
  <UplotChart {opts} {data} fill />
{/if}
