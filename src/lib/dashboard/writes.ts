// Dashboard writes, one at a time, without dropping input. Pure — no stores,
// no DOM.
//
// The dashboard's controls stay enabled while a write is in flight: disabling
// a focused control throws keyboard focus to the page, so the next arrow key
// scrolls instead of stepping the slider. Input can therefore arrive mid-write.
// Rather than drop it (which leaves a control showing a value the charger
// never got), the runner holds it: one slot per control, latest wins, run in
// arrival order once the current write finishes. A burst of slider steps ends
// on the value the user stopped at, in two writes rather than one per step.

type Action = () => Promise<unknown>

export interface WriteRunner {
  /** Run `action` now, or hold it as `key`'s next write if one is in flight. */
  run(key: string, action: Action): Promise<void>
  /** True while a write (or a held one) is running. */
  readonly busy: boolean
}

export function createWriteRunner(): WriteRunner {
  let busy = false
  // Map keeps insertion order; re-setting a held key keeps its slot.
  const held = new Map<string, Action>()

  async function run(key: string, action: Action): Promise<void> {
    if (busy) {
      held.set(key, action)
      return
    }
    busy = true
    let failed = false
    let failure: unknown
    try {
      let next: Action | undefined = action
      while (next) {
        try {
          await next()
        } catch (e) {
          // Keep draining: a held write for another control must not be lost
          // because this one threw. The first failure is rethrown below.
          if (!failed) {
            failed = true
            failure = e
          }
        }
        const entry = held.entries().next()
        if (entry.done) next = undefined
        else {
          held.delete(entry.value[0])
          next = entry.value[1]
        }
      }
    } finally {
      busy = false
    }
    if (failed) throw failure
  }

  return {
    run,
    get busy() {
      return busy
    },
  }
}
