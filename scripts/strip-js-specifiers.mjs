// TypeScript-migration helper. Rewrites relative import / vi.mock specifiers
// that end in ".js" to be extensionless wherever the target now exists as a
// .ts file (including x.svelte.js → x.svelte.ts). Idempotent — safe to re-run
// after every batch of renames. Delete once the migration is complete.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'

const files = execSync("git ls-files 'src/**/*.js' 'src/**/*.ts' 'src/**/*.svelte'", {
  encoding: 'utf8',
})
  .split('\n')
  .filter(Boolean)

// '../stores/config.js'  →  captures quote + '../stores/config'
const SPEC = /(['"])(\.{1,2}\/[^'"\n]+?)\.js\1/g

let changed = 0
for (const file of files) {
  const src = readFileSync(file, 'utf8')
  const out = src.replace(SPEC, (match, quote, spec) => {
    const target = resolve(dirname(file), spec) + '.ts'
    return existsSync(target) ? `${quote}${spec}${quote}` : match
  })
  if (out !== src) {
    writeFileSync(file, out)
    changed++
  }
}
console.log(`strip-js-specifiers: rewrote ${changed} file(s)`)
