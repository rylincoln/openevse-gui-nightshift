import { it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// WCAG 1.4.4: people must be able to zoom to 200%. Android browsers honour
// user-scalable=no and maximum-scale, so either one locks pinch-zoom off.
it('lets people zoom the page', () => {
  const html = readFileSync(resolve('index.html'), 'utf8')
  const viewport = html.match(/<meta\s+name="viewport"\s+content="([^"]*)"/)?.[1]
  expect(viewport).toBeDefined()
  expect(viewport).not.toMatch(/user-scalable\s*=\s*(no|0)/)
  const max = viewport.match(/maximum-scale\s*=\s*([\d.]+)/)?.[1]
  if (max !== undefined) expect(Number(max)).toBeGreaterThanOrEqual(2)
})
