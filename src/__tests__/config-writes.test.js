// Config is written one way: through the config form (createConfigForm),
// which marks each field saving / saved / failed, puts inputs back when the
// charger refuses, raises the one write-failure alert and decides what a
// cleared field writes. A page that called config_store directly would
// quietly do none of that.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const SRC = join(__dirname, '..')
const FORM = 'lib/config/configForm.svelte.ts'

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (name === '__tests__' || name === 'node_modules') return []
    if (statSync(p).isDirectory()) return sourceFiles(p)
    return /\.(svelte|ts)$/.test(name) ? [p] : []
  })
}

describe('config writes', () => {
  it('go through the config form only', () => {
    const writers = sourceFiles(SRC)
      .map((p) => ({ path: relative(SRC, p), text: readFileSync(p, 'utf8') }))
      .filter((f) => f.path !== FORM && /config_store\.upload\(/.test(f.text))
      .map((f) => f.path)
    expect(writers).toEqual([])
  })
})
