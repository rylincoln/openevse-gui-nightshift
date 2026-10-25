/**
 * Format a device clock time ("HH:MM" or "HH:MM:SS") in the locale's own
 * convention: "11:00 PM" in English, "23:00" in French. Anything that isn't a
 * time passes through unchanged.
 */
export function formatClock(hhmm: string, lang: string | null | undefined): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm ?? '')
  if (!m) return hhmm
  const d = new Date(2000, 0, 1, Number(m[1]), Number(m[2]))
  return d.toLocaleTimeString(lang || 'en', { hour: 'numeric', minute: '2-digit' })
}
