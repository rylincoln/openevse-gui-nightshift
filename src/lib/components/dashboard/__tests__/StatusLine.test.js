import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k, opts) => (opts?.values ? k + ':' + JSON.stringify(opts.values) : k)
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import StatusLine from '../StatusLine.svelte'

const paused = {
  tone: 'sleep',
  headline: { key: 'dashboard.line.paused' },
  plug: { key: 'dashboard.line.plug_in' },
  reason: { key: 'dashboard.line.why.timer_since', values: { since: '7:00 AM' } },
  next: { key: 'dashboard.line.next.resumes', values: { time: '11:00 PM' } },
}

describe('StatusLine', () => {
  it('says the state, whether a car is plugged in, why, and what comes next', () => {
    const { getByText } = render(StatusLine, { status: paused })
    expect(getByText('dashboard.line.paused')).toBeInTheDocument()
    expect(getByText('dashboard.line.plug_in')).toBeInTheDocument()
    expect(getByText('dashboard.line.why.timer_since:{"since":"7:00 AM"}')).toBeInTheDocument()
    expect(getByText('dashboard.line.next.resumes:{"time":"11:00 PM"}')).toBeInTheDocument()
  })

  it('colours the headline by tone', () => {
    const { getByText } = render(StatusLine, { status: paused })
    expect(getByText('dashboard.line.paused').closest('p').className).toContain('text-sleep')
  })

  it('emphasises the next step over the reason', () => {
    const { getByText } = render(StatusLine, { status: paused })
    expect(getByText(/next\.resumes/).className).toContain('text-text')
    expect(getByText(/why\.timer_since/).className).toContain('text-text-dim')
  })

  it('leaves out the parts a state does not have', () => {
    const { container } = render(StatusLine, {
      status: { tone: 'success', headline: { key: 'dashboard.line.ready' }, plug: null, reason: null, next: null },
    })
    expect(container.querySelectorAll('p')).toHaveLength(1)
  })
})
