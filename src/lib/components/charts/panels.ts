import type uPlot from 'uplot'
import type { ChartTheme } from './chartTheme'

// Charts here are small multiples: one measure per panel, each with its own
// single value axis, stacked on a shared time axis. Measures of different
// units never share a plot (no second y-axis), and with one series per panel
// the panel's title names it, so every line can wear the accent colour and
// the status colours stay free for status.

/** Value-axis width in px, fixed so stacked panels' plot areas line up. */
export const PANEL_AXIS_SIZE = 44

export interface PanelSpec {
  /** uPlot scale key for the panel's one series. */
  scale: string
  /** Series label (uPlot's own, not shown: the legend is off). */
  label: string
  range: uPlot.Scale['range']
  /** Panels with the same key move their cursors together. */
  syncKey: string
  /** Only the bottom panel prints the time labels. */
  showX: boolean
  height?: number
  xTime?: boolean
  xValues?: uPlot.Axis['values']
  yValues?: uPlot.Axis['values']
  /** Shade under the line. */
  area?: boolean
  plugins?: uPlot.Plugin[]
}

export function panelOpts(theme: ChartTheme, spec: PanelSpec): Omit<uPlot.Options, 'width' | 'height'> & { height?: number } {
  const blank = (_u: uPlot | null, splits: number[]): string[] => splits.map(() => '')
  return {
    ...(spec.height ? { height: spec.height } : {}),
    cursor: { drag: { x: false, y: false }, sync: { key: spec.syncKey } },
    legend: { show: false },
    scales: {
      x: { time: spec.xTime ?? false },
      [spec.scale]: { range: spec.range },
    },
    axes: [
      {
        stroke: theme.axisText,
        grid: { stroke: theme.grid, width: 1 },
        ticks: { show: spec.showX },
        size: spec.showX ? 30 : 4,
        // Left out (not undefined) when unset, so uPlot keeps its own labels.
        ...(spec.showX ? (spec.xValues ? { values: spec.xValues } : {}) : { values: blank }),
      },
      {
        scale: spec.scale,
        stroke: theme.axisText,
        grid: { stroke: theme.grid, width: 1 },
        size: PANEL_AXIS_SIZE,
        ...(spec.yValues ? { values: spec.yValues } : {}),
      },
    ],
    series: [
      {},
      {
        label: spec.label,
        scale: spec.scale,
        stroke: theme.accent,
        width: 2,
        ...(spec.area ? { fill: theme.accent + '22' } : {}),
        points: { show: false },
      },
    ],
    plugins: spec.plugins ?? [],
  }
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

/** A dot on the newest real reading, ringed in the surface colour so it
 *  stands off the line it sits on. */
export function liveDotPlugin(color: string, ring: string): uPlot.Plugin {
  return {
    hooks: {
      draw: (u: uPlot) => {
        const xs = u.data[0]
        const ys = u.data[1]
        let i = ys.length - 1
        while (i >= 0 && !isFiniteNumber(ys[i])) i--
        if (i < 0) return
        const scale = u.series[1].scale ?? 'y'
        const cx = u.valToPos(xs[i], 'x', true)
        const cy = u.valToPos(ys[i] as number, scale, true)
        const { ctx } = u
        ctx.save()
        ctx.fillStyle = ring
        ctx.beginPath()
        ctx.arc(cx, cy, 5.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(cx, cy, 3.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      },
    },
  }
}

/** A dashed line at a target value, labelled at its right-hand end. */
export function targetLinePlugin(target: number | null | undefined, color: string, label: string): uPlot.Plugin {
  return {
    hooks: {
      draw: (u: uPlot) => {
        if (!isFiniteNumber(target)) return
        const scale = u.series[1].scale ?? 'y'
        const y = u.valToPos(target, scale, true)
        const { ctx } = u
        const right = u.bbox.left + u.bbox.width
        ctx.save()
        ctx.strokeStyle = color
        ctx.setLineDash([4, 4])
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(u.bbox.left, y)
        ctx.lineTo(right, y)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = color
        ctx.font = `${11 * (typeof devicePixelRatio === 'number' ? devicePixelRatio : 1)}px system-ui, sans-serif`
        ctx.textAlign = 'right'
        ctx.textBaseline = 'bottom'
        ctx.fillText(label, right - 4, y - 3)
        ctx.restore()
      },
    },
  }
}
