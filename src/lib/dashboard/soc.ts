/** Pure helpers for the Vehicle SOC bar. No store or DOM access — fully unit-tested. */

/** Clamp a value to 0..100; non-finite becomes 0. */
function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, n))
}

/**
 * The "no limit" knob position: the vehicle limit when known, else 100.
 * The knob resting here (or being dragged at/above it) means OpenEVSE imposes
 * no soc limit of its own — the car governs.
 */
export function socCeiling(vehicleLimit: number | null | undefined): number {
  return typeof vehicleLimit === 'number' && Number.isFinite(vehicleLimit) ? clampPct(vehicleLimit) : 100
}

/** True when the target sits above the vehicle's own limit (shown red while dragging). */
export function isCapped(target: number, vehicleLimit: number | null | undefined): boolean {
  return typeof vehicleLimit === 'number' && Number.isFinite(vehicleLimit) && target > vehicleLimit
}

/** Where charging actually stops: min(target, vehicleLimit) when the limit is known. */
export function effectiveStop(target: number, vehicleLimit: number | null | undefined): number {
  return typeof vehicleLimit === 'number' && Number.isFinite(vehicleLimit) ? Math.min(target, vehicleLimit) : target
}

/**
 * Bar geometry as 0..100 percentages.
 *  fillPct     solid SOC fill
 *  zoneEndPct  end of the lighter "will charge to" zone (= effective stop, never below SOC)
 */
export interface SocBarSegments {
  fillPct: number
  zoneEndPct: number
}

export function socBarSegments({
  soc,
  target,
  vehicleLimit,
}: {
  soc: number
  target: number
  vehicleLimit: number | null | undefined
}): SocBarSegments {
  const s = clampPct(soc)
  const t = clampPct(target)
  const eff = clampPct(effectiveStop(t, vehicleLimit))
  return {
    fillPct: s,
    zoneEndPct: Math.max(s, eff),
  }
}

/** Short H/M duration: 4500 -> "1h 15m", 600 -> "10m", 0/invalid -> "". */
export function hmsShort(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return ''
  let h = Math.floor(sec / 3600)
  let m = Math.round((sec % 3600) / 60)
  if (m === 60) {
    h += 1
    m = 0
  }
  return h ? `${h}h ${m}m` : `${m}m`
}

/** Estimated pack max range from a current range reading and SOC %. null if not derivable. */
export function estMaxRange(
  batteryRange: number | null | undefined,
  soc: number | null | undefined,
): number | null {
  if (typeof batteryRange !== 'number' || !Number.isFinite(batteryRange)) return null
  if (typeof soc !== 'number' || !Number.isFinite(soc) || soc <= 0) return null
  return batteryRange / (soc / 100)
}
