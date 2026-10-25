import { describe, it, expect, beforeEach } from 'vitest'
import { readChartTheme } from '../chartTheme'

function setVar(name, value) {
  document.documentElement.style.setProperty(name, value)
}

describe('readChartTheme', () => {
  beforeEach(() => {
    setVar('--accent',   '#0f9b98')
    setVar('--text-dim', '#5b6b72')
    setVar('--border',   '#e4eae9')
    setVar('--surface',  '#f0f4f3')
  })

  it('resolves the documented CSS vars', () => {
    const t = readChartTheme()
    expect(t.accent).toBe('#0f9b98')
    expect(t.axisText).toBe('#5b6b72')
    expect(t.grid).toBe('#e4eae9')
    expect(t.surface).toBe('#f0f4f3')
  })

  it('keeps the status colours out of charts', () => {
    const t = readChartTheme()
    expect(Object.keys(t).sort()).toEqual(['accent', 'axisText', 'grid', 'surface'])
  })

  it('falls back to safe defaults when a var is missing', () => {
    setVar('--accent', '')
    const t = readChartTheme()
    expect(t.accent).toMatch(/^#/)
  })
})
