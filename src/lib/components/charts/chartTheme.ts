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
    accent: v('--accent', '#0f9b98'),
    charging: v('--charging', '#0f9b98'),
    warning: v('--warning', '#d98a2b'),
    success: v('--success', '#2ea052'),
    axisText: v('--text-dim', '#5b6b72'),
    grid: v('--border', '#e4eae9'),
  }
}
