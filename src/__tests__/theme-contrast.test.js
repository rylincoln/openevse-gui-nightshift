import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

// Every colour token that carries text must reach WCAG AA (4.5:1) wherever
// the app puts it: on the three surfaces, and for the status colours also on
// their own 15% tint (the bg-error/15 banners and pills).
// Read from disk: vitest stubs CSS imports, ?raw included. Tests run from
// the repo root.
const css = readFileSync(resolve('src/app.css'), 'utf8')

function tokens(selector) {
  const start = css.indexOf(selector)
  const block = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start))
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})\s*;/gi)].map(([, k, v]) => [k, v]))
}

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
const linear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const luminance = (hex) => {
  const [r, g, b] = rgb(hex).map(linear)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
// `fg` at `alpha` over `bg`, as bg-<token>/15 renders it.
const tint = (fg, bg, alpha) =>
  '#' + rgb(fg).map((c, i) => Math.round((c * alpha + rgb(bg)[i] * (1 - alpha)) * 255).toString(16).padStart(2, '0')).join('')

// Anchored on the rule's opening brace: the bare selector also appears in
// the @custom-variant line at the top of the file.
const themes = {
  light: tokens(':root,\n[data-theme="light"] {'),
  dark: tokens('[data-theme="dark"] {'),
}

describe.each(Object.entries(themes))('%s theme contrast', (_name, t) => {
  it('parses the theme block', () => {
    expect(t.surface).toMatch(/^#/)
    expect(t.accent).toMatch(/^#/)
  })

  it.each(['text', 'text-dim'])('%s reads on every surface', (k) => {
    for (const bg of [t.surface, t['surface-2'], t['surface-3']]) {
      expect(contrast(t[k], bg), `${k} ${t[k]} on ${bg}`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it.each(['accent', 'charging', 'error', 'warning', 'sleep', 'success'])(
    '%s reads on the surfaces and on its own tint',
    (k) => {
      for (const bg of [t.surface, t['surface-2']]) {
        expect(contrast(t[k], bg), `${k} ${t[k]} on ${bg}`).toBeGreaterThanOrEqual(4.5)
        const tinted = tint(t[k], bg, 0.15)
        expect(contrast(t[k], tinted), `${k} ${t[k]} on its tint ${tinted}`).toBeGreaterThanOrEqual(4.5)
      }
    },
  )

  it('primary button labels (surface on accent) read', () => {
    expect(contrast(t.surface, t.accent)).toBeGreaterThanOrEqual(4.5)
  })
})

// White reads on the light theme's fills but not the dark theme's (about
// 2:1), so a solid theme-colour fill labels its text with text-surface,
// the way Button's primary variant does.
it('never pairs white text with a solid theme-colour fill', () => {
  const offenders = readdirSync('src', { recursive: true })
    .filter((f) => f.endsWith('.svelte'))
    .flatMap((f) =>
      [...readFileSync(join('src', f), 'utf8').matchAll(/class="([^"]*)"/g)]
        .filter(([, cls]) => /(^|\s)text-white(\s|$)/.test(cls) && /(^|\s)bg-(accent|charging|error|warning|sleep|success)(\s|$)/.test(cls))
        .map(() => f),
    )
  expect(offenders).toEqual([])
})
