import { describe, it, expect } from 'vitest'
import { createWriteRunner } from '../writes'

/** A promise the test settles by hand, to hold a write "in flight". */
function deferred() {
  let resolve, reject
  const promise = new Promise((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

describe('createWriteRunner', () => {
  it('runs an action straight away when nothing is in flight', async () => {
    const runner = createWriteRunner()
    const log = []
    await runner.run('limit', async () => { log.push('a') })
    expect(log).toEqual(['a'])
  })

  it('holds an action that arrives mid-write and runs it afterwards', async () => {
    const runner = createWriteRunner()
    const first = deferred()
    const log = []
    const done = runner.run('limit', async () => { log.push('79'); await first.promise })
    runner.run('limit', async () => { log.push('78') })
    expect(log).toEqual(['79'])
    first.resolve()
    await done
    expect(log).toEqual(['79', '78'])
  })

  it('keeps only the latest held action for a control', async () => {
    const runner = createWriteRunner()
    const first = deferred()
    const log = []
    const done = runner.run('limit', async () => { log.push('79'); await first.promise })
    for (const v of ['78', '77', '76']) runner.run('limit', async () => { log.push(v) })
    first.resolve()
    await done
    expect(log).toEqual(['79', '76'])
  })

  it('runs held actions for different controls in the order they arrived', async () => {
    const runner = createWriteRunner()
    const first = deferred()
    const log = []
    const done = runner.run('limit', async () => { log.push('limit 79'); await first.promise })
    runner.run('mode', async () => { log.push('mode off') })
    runner.run('limit', async () => { log.push('limit 76') })
    first.resolve()
    await done
    expect(log).toEqual(['limit 79', 'mode off', 'limit 76'])
  })

  it('reports whether a write is in flight', async () => {
    const runner = createWriteRunner()
    const first = deferred()
    expect(runner.busy).toBe(false)
    const done = runner.run('mode', () => first.promise)
    expect(runner.busy).toBe(true)
    first.resolve()
    await done
    expect(runner.busy).toBe(false)
  })

  it('carries on with held actions after one throws', async () => {
    const runner = createWriteRunner()
    const first = deferred()
    const log = []
    const done = runner.run('limit', async () => { await first.promise })
    runner.run('mode', async () => { log.push('mode off') })
    first.reject(new Error('network'))
    await expect(done).rejects.toThrow('network')
    expect(log).toEqual(['mode off'])
    expect(runner.busy).toBe(false)
  })
})
