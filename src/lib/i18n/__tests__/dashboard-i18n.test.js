import { describe, it, expect } from 'vitest'
import en from '../en.json'

describe('dashboard i18n keys', () => {
  it('has the dashboard block', () => {
    expect(en.dashboard.line.charging).toBeTypeOf('string')
    expect(en.dashboard.line.why.off).toBeTypeOf('string')
    expect(en.dashboard.line.next.off).toBeTypeOf('string')
    expect(en.dashboard.chips.current).toBeTypeOf('string')
    expect(en.dashboard.mode.auto).toBeTypeOf('string')
    expect(en.dashboard.limit.pills_aria).toBeTypeOf('string')
  })
})
