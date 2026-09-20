<script lang="ts">
  import { _ } from 'svelte-i18n'
  import uPlot from 'uplot'
  import type { ComponentProps } from 'svelte'
  import UplotChart from './UplotChart.svelte'
  import { readChartTheme } from './chartTheme'

  // The daily/monthly/annual summary rows all reduce to this shape before
  // reaching the chart — see EnergyTab.svelte's `summaryRows`, which is built
  // from `EnergyDaily`/`EnergyMonthly`/`EnergyAnnual` (device.ts).
  interface Row {
    /** X-axis label (e.g. "2026-05-24", "May", "2025") */
    label: string
    /** Energy total for the bucket */
    kwh: number
  }
  interface Props {
    rows?: Row[]
  }
  let { rows = [] }: Props = $props()

  let data: ComponentProps<typeof UplotChart>['data'] = $derived.by(() => {
    // Use ordinal x positions (0..n-1) and emit string labels via splits/values.
    const xs = rows.map((_r, i) => i)
    const ys = rows.map((r) => r.kwh)
    return [xs, ys]
  })

  let opts: ComponentProps<typeof UplotChart>['opts'] = $derived.by(() => {
    const theme = readChartTheme()
    return {
      legend: { show: false },
      cursor: { drag: { x: false, y: false } },
      scales: {
        x: { time: false, range: (_u, _min, _max) => [-0.5, Math.max(0, rows.length - 0.5)] },
      },
      axes: [
        {
          stroke: theme.axisText,
          grid: { stroke: theme.grid, width: 1 },
          // Thin x-axis labels based on plot area width so narrow screens
          // (e.g. iPhone) don't collide 40 daily labels into a smear.
          // Target ~55 px per label; stride the rows by the resulting count.
          splits: (u) => {
            const plotW = u?.bbox?.width ? u.bbox.width / devicePixelRatio : 320
            const maxLabels = Math.max(2, Math.floor(plotW / 55))
            if (rows.length <= maxLabels) return rows.map((_r, i) => i)
            const stride = Math.ceil(rows.length / maxLabels)
            const out = []
            for (let i = 0; i < rows.length; i += stride) out.push(i)
            return out
          },
          values: (_u, splits) => splits.map((i) => rows[i]?.label ?? ''),
        },
        {
          stroke: theme.axisText,
          grid: { stroke: theme.grid, width: 1 },
          label: 'kWh',
        },
      ],
      series: [
        {},
        {
          label: 'kWh',
          stroke: theme.accent,
          fill: theme.accent + '55',
          width: 1,
          paths: uPlot.paths.bars?.({ size: [0.65, 60] }),
          points: { show: false },
        },
      ],
    }
  })
</script>

{#if rows.length === 0}
  <div class="py-12 text-center text-sm text-text-dim">{$_('monitoring.energy.no_samples')}</div>
{:else}
  <UplotChart {opts} {data} fill />
{/if}
