import { describe, it, expect } from 'vitest'
import { versionedResources } from '../versioned'

// A resource whose version is `field` on the status, and whose downloads the
// test settles one at a time. `frames` records the status each download got.
function resource(field) {
  const frames = []
  const pending = []
  return {
    frames,
    version: (s) => s[field],
    download: (s) => {
      frames.push(s)
      return new Promise((resolve) => pending.push(resolve))
    },
    finish: async (ok = true) => {
      pending.shift()(ok)
      // Let the module see the outcome before the test looks.
      await new Promise((r) => setTimeout(r, 0))
    },
  }
}

describe('versionedResources', () => {
  it('downloads a resource when it first reports a version, then not while the version holds', async () => {
    const config = resource('config_version')
    const res = versionedResources({ config })
    res.observe({ config_version: 1 })
    expect(config.frames).toHaveLength(1)
    await config.finish()
    res.observe({ config_version: 1, amp: 16 })
    res.observe({ config_version: 1, amp: 32 })
    expect(config.frames).toHaveLength(1)
  })

  it('downloads again when the version moves', async () => {
    const config = resource('config_version')
    const res = versionedResources({ config })
    res.observe({ config_version: 1 })
    await config.finish()
    res.observe({ config_version: 2 })
    expect(config.frames).toHaveLength(2)
  })

  it('counts a first version of 0 as a version', () => {
    const boost = resource('boost_version')
    versionedResources({ boost }).observe({ boost_version: 0 })
    expect(boost.frames).toHaveLength(1)
  })

  // Capability gate: firmware without the feature sends no counter for it.
  it('leaves a resource alone while the charger reports no version for it', () => {
    const boost = resource('boost_version')
    const res = versionedResources({ boost })
    res.observe({ state: 1 })
    res.observe({ state: 3, boost_version: null })
    expect(boost.frames).toHaveLength(0)
  })

  it('does not download again what was already loaded at that version', () => {
    const config = resource('config_version')
    const res = versionedResources({ config })
    res.loaded(['config'], { config_version: 4 })
    res.observe({ config_version: 4 })
    expect(config.frames).toHaveLength(0)
    res.observe({ config_version: 5 })
    expect(config.frames).toHaveLength(1)
  })

  // What came back may predate the bump, so it must not be the last word.
  it('follows a download during which the version moved with one more, of the latest frame', async () => {
    const schedule = resource('schedule_version')
    const res = versionedResources({ schedule })
    res.observe({ schedule_version: 1 })
    res.observe({ schedule_version: 2 })
    res.observe({ schedule_version: 3 })
    expect(schedule.frames).toHaveLength(1)

    await schedule.finish()
    expect(schedule.frames).toHaveLength(2)
    expect(schedule.frames[1]).toEqual({ schedule_version: 3 })

    await schedule.finish()
    res.observe({ schedule_version: 3 })
    expect(schedule.frames).toHaveLength(2)
  })

  it('needs no follow-up when frames during a download repeat its version', async () => {
    const schedule = resource('schedule_version')
    const res = versionedResources({ schedule })
    res.observe({ schedule_version: 1 })
    res.observe({ schedule_version: 1, amp: 32 })
    await schedule.finish()
    expect(schedule.frames).toHaveLength(1)
  })

  it('retries a failed download on the next frame, not straight away', async () => {
    const plan = resource('schedule_plan_version')
    const res = versionedResources({ plan })
    res.observe({ schedule_plan_version: 1 })
    await plan.finish(false)
    expect(plan.frames).toHaveLength(1)
    res.observe({ schedule_plan_version: 1 })
    expect(plan.frames).toHaveLength(2)
  })

  it('keeps each resource to its own pace', async () => {
    const config = resource('config_version')
    const limit = resource('limit_version')
    const res = versionedResources({ config, limit })
    res.observe({ config_version: 1, limit_version: 1 })
    res.observe({ config_version: 1, limit_version: 2 })
    expect(config.frames).toHaveLength(1)
    expect(limit.frames).toHaveLength(1)
    await limit.finish()
    expect(limit.frames).toHaveLength(2)
    expect(config.frames).toHaveLength(1)
  })
})
