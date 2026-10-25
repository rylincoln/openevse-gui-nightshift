import type { EnergySample } from '../api/device'
import type { ChartTheme } from '../components/charts/chartTheme'
import { panelOpts, liveDotPlugin, targetLinePlugin } from '../components/charts/panels'

// Pure transforms turning /energy/raw samples into chart-ready data.
// Sample shape: { ts:<unix s>, a:<amps>, t:<°C>, e:<energy>, s:<soc %, -1 = none> }

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

/** Keep only samples within `sessionElapsed` seconds of the newest sample.
 *  Falls back to all samples when elapsed is absent/0 (e.g. flaky firmware). */
export function clipToSession(samples: EnergySample[] | undefined, sessionElapsed: number): EnergySample[] {
  if (!Array.isArray(samples) || samples.length === 0) return []
  if (!Number.isFinite(sessionElapsed) || sessionElapsed <= 0) return samples
  // /energy/raw returns samples in chronological order, so the last is newest.
  const start = samples[samples.length - 1].ts - sessionElapsed
  return samples.filter((s) => s.ts >= start)
}

/** kW for one sample = amps * volts * phases / 1000. Null when voltage/amps
 *  unusable. `phases` is 3 on a 3-phase charger (firmware reports per-phase
 *  amps, so total power triples — matches maxPowerW() for the PowerRing). */
export function sampleKw(sample: EnergySample, voltage: number, phases: number = 1): number | null {
  if (!Number.isFinite(voltage) || voltage <= 0) return null
  if (!Number.isFinite(sample?.a)) return null
  return (sample.a * voltage * phases) / 1000
}

/** SOC percent, or null for the -1 "no vehicle source" sentinel. */
export function socOrNull(sample: EnergySample): number | null {
  return Number.isFinite(sample?.s) && sample.s >= 0 ? sample.s : null
}

/** [relativeSeconds[], soc[], kw[]] for uPlot, x measured from the first sample. */
export function toChartData(
  samples: EnergySample[],
  voltage: number,
  phases: number = 1,
): [number[], (number | null)[], (number | null)[]] {
  const x0 = samples.length ? samples[0].ts : 0
  const x = samples.map((s) => s.ts - x0)
  const soc = samples.map(socOrNull)
  const kw = samples.map((s) => sampleKw(s, voltage, phases))
  return [x, soc, kw]
}

/** Right-axis ceiling for the kW line: peak + 1 headroom, floored at 4. */
export function kwAxisMax(kwValues: (number | null | undefined)[] | undefined): number {
  const finite = (kwValues || []).filter(isFiniteNumber)
  const peak = finite.length ? Math.max(...finite) : 0
  return Math.max(4, Math.ceil(peak + 1))
}

/** Format x-axis tick (relative seconds) as "0", "25m", or "1h05". */
export function fmtSessionTime(sec: number): string {
  let m = Math.round(sec / 60)
  if (m === 0) return '0'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  return `${h}h${String(m % 60).padStart(2, '0')}`
}

/** The state-of-charge panel: SOC alone on 0–100, the target dashed and
 *  labelled, the latest reading dotted. Its time labels are the kW panel's. */
export function buildSocOpts({
  theme,
  target,
  targetLabel,
  height,
  syncKey,
}: {
  theme: ChartTheme
  target: number | null | undefined
  targetLabel: string
  height: number
  syncKey: string
}): ReturnType<typeof panelOpts> {
  return panelOpts(theme, {
    scale: 'soc',
    label: 'SOC',
    range: [0, 100],
    syncKey,
    showX: false,
    height,
    area: true,
    plugins: [targetLinePlugin(target, theme.axisText, targetLabel), liveDotPlugin(theme.accent, theme.surface)],
  })
}

/** The power panel: kW alone from zero, with the session time under it. */
export function buildKwOpts({
  theme,
  kwMax,
  height,
  syncKey,
}: {
  theme: ChartTheme
  kwMax: number
  height: number
  syncKey: string
}): ReturnType<typeof panelOpts> {
  return panelOpts(theme, {
    scale: 'kw',
    label: 'kW',
    range: [0, kwMax],
    syncKey,
    showX: true,
    height,
    area: true,
    xValues: (_u, splits) => splits.map(fmtSessionTime),
    plugins: [liveDotPlugin(theme.accent, theme.surface)],
  })
}
