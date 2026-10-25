/** Boost wording shared by the Boost card and the dashboard status line. */
import type { Boost } from '../api/device'
import { targetText } from '../chargeLimit'

type Translate = (key: string, opts?: { values: Record<string, string> }) => string

/** An active boost's target: "for 1:30:00", "add 5.0 kWh", "until 80%". Worded as a charge limit is. */
export function boostTarget(active: Boost | null | undefined, t: Translate, rangeUnit: string): string {
  if (!active || active.type === 'none') return ''
  const value = targetText(active.type, active.value, t, rangeUnit)
  const key = active.type === 'time' ? 'for' : active.type === 'energy' ? 'add' : 'until'
  return t(`dashboard.boost.${key}`, { values: { value } })
}
