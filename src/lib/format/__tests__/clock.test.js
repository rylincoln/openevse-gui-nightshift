import { describe, it, expect } from 'vitest'
import { formatClock, formatHour } from '../clock'

// Intl puts a narrow no-break space before AM/PM; compare on plain spaces.
const plain = (s) => s.replace(/\s/g, ' ')

describe('formatClock', () => {
  it('uses a 12-hour clock in English', () => {
    expect(plain(formatClock('23:00', 'en'))).toBe('11:00 PM')
    expect(plain(formatClock('07:05', 'en'))).toBe('7:05 AM')
  })
  it('uses a 24-hour clock where the locale does', () => {
    expect(formatClock('23:00', 'fr')).toBe('23:00')
    expect(formatClock('07:05', 'hu')).toBe('7:05')
  })
  it('drops the seconds the plan carries', () => {
    expect(plain(formatClock('23:00:00', 'en'))).toBe('11:00 PM')
  })
  it('passes anything that is not a time through unchanged', () => {
    expect(formatClock('', 'en')).toBe('')
    expect(formatClock('soon', 'en')).toBe('soon')
  })
  it('falls back to English for an unknown locale', () => {
    expect(plain(formatClock('23:00', null))).toBe('11:00 PM')
  })
})

describe('formatHour', () => {
  it('names an hour the short way the locale does', () => {
    expect(plain(formatHour(18, 'en'))).toBe('6 PM')
    expect(plain(formatHour(0, 'en'))).toBe('12 AM')
    expect(plain(formatHour(18, 'fr'))).toBe('18 h')
  })
  it('falls back to English for an unknown locale', () => {
    expect(plain(formatHour(6, undefined))).toBe('6 AM')
  })
})
