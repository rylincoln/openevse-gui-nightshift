// Guards for the app-wide visual rules that no single component test sees.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const SRC = join(__dirname, '..')

function svelteFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (name === '__tests__' || name === 'node_modules') return []
    if (statSync(p).isDirectory()) return svelteFiles(p)
    return name.endsWith('.svelte') ? [p] : []
  })
}
const files = svelteFiles(SRC).map((p) => ({ path: relative(SRC, p), text: readFileSync(p, 'utf8') }))
const offending = (re) => files.filter((f) => re.test(f.text)).map((f) => f.path)

describe('visual consistency', () => {
  // Labels are set in sentence case by the copy; shouting them in tiny
  // tracked capitals made them the hardest text on the page to read.
  it('sets no label in all caps', () => {
    expect(offending(/\buppercase\b/)).toEqual([])
  })

  it('sets no text below 11 px', () => {
    expect(offending(/text-\[(?:[0-9]|10)px\]/)).toEqual([])
  })

  // The bars fill in the accent; a teal-to-sky blend carried no meaning.
  it('fills progress bars with the accent, not a decorative gradient', () => {
    expect(offending(/to-cyan-/)).toEqual([])
  })

  // While charging the fill shimmers, in a lighter band of the same accent.
  it('shimmers a charging bar in the accent only', () => {
    const css = readFileSync(join(SRC, 'app.css'), 'utf8')
    const rule = css.match(/\.soc-shimmer\s*\{[^}]*\}/)[0]
    expect(rule).not.toMatch(/#[0-9a-f]{3,8}\b/i)
  })

  // One page width for every screen, so the title stays put as you move
  // between them; narrower content sits inside it, aligned left.
  it('gives every screen the same page width', () => {
    for (const path of [
      'routes/Dashboard.svelte',
      'routes/ChargeManager.svelte',
      'routes/Monitoring.svelte',
      'routes/History.svelte',
      'routes/Settings.svelte',
      'lib/components/config/ConfigPage.svelte',
    ]) {
      const section = files.find((f) => f.path === path).text.match(/<section[^>]*class="([^"]*)"/)[1]
      expect(section, path).toMatch(/\blg:max-w-5xl\b/)
    }
  })
})
