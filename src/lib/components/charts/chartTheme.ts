function v(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return raw || fallback
}

/**
 * Chart colours resolved from the app's CSS theme variables. Deliberately no
 * status colours (charging, warning, success, error): those mean a state of
 * the charger, and a data series wearing one reads as that state.
 */
export interface ChartTheme {
  accent: string
  axisText: string
  grid: string
  /** The page behind the chart, for rings that lift a mark off a line. */
  surface: string
}

export function readChartTheme(): ChartTheme {
  return {
    accent: v('--accent', '#026664'),
    axisText: v('--text-dim', '#51616b'),
    grid: v('--border', '#e4eae9'),
    surface: v('--surface', '#f0f4f3'),
  }
}
