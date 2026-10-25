function v(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return raw || fallback
}

/** Chart colours resolved from the app's CSS theme variables. */
export interface ChartTheme {
  accent: string
  charging: string
  warning: string
  success: string
  axisText: string
  grid: string
}

export function readChartTheme(): ChartTheme {
  return {
    accent: v('--accent', '#026664'),
    charging: v('--charging', '#026664'),
    warning: v('--warning', '#844f04'),
    success: v('--success', '#05692e'),
    axisText: v('--text-dim', '#51616b'),
    grid: v('--border', '#e4eae9'),
  }
}
