/** Boost wording shared by the Boost card and the dashboard status line. */
import type { Boost } from '../api/device'

type Translate = (key: string, opts?: { values: Record<string, string> }) => string

/** Seconds as m:ss, or h:mm:ss from an hour up. */
export function fmtDur(sec: number): string {
  sec = Math.max(0, Math.round(sec))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

/** An active boost's target: "for 1:30:00", "add 5.0 kWh", "until 80%". */
export function boostTarget(active: Boost | null | undefined, t: Translate, rangeUnit: string): string {
  if (!active) return ''
  if (active.type === 'time') return t('dashboard.boost.for', { values: { value: fmtDur(active.value) } })
  if (active.type === 'energy')
    return t('dashboard.boost.add', { values: { value: `${(active.value / 1000).toFixed(1)} ${t('units.kwh')}` } })
  if (active.type === 'soc')
    return t('dashboard.boost.until', { values: { value: `${active.value}${t('units.percent')}` } })
  return t('dashboard.boost.until', { values: { value: `${active.value} ${rangeUnit}` } })
}
