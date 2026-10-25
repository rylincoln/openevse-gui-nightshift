// src/routes/__tests__/Login.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k, opts) => (opts?.values ? k + ':' + JSON.stringify(opts.values) : k)
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})
vi.mock('../../lib/router', () => ({ redirect: vi.fn() }))

import { redirect } from '../../lib/router'
import Login from '../Login.svelte'

let fetchMock
beforeEach(() => {
  fetchMock = vi.fn(() => Promise.resolve({ ok: true, status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
  redirect.mockReset()
})
afterEach(() => vi.unstubAllGlobals())

const bodies = () => fetchMock.mock.calls.map((c) => JSON.parse(c[1].body))

describe('Login', () => {
  it('sends what was typed when Enter submits the form', async () => {
    // Enter in a form: the browser clicks the submit button while the field
    // still has focus -- it has not blurred, so it has not committed its value.
    const utils = render(Login)
    const [user, pass] = utils.container.querySelectorAll('input')
    await fireEvent.input(user, { target: { value: 'admin' } })
    await fireEvent.blur(user)
    pass.focus()
    await fireEvent.focus(pass)
    await fireEvent.input(pass, { target: { value: 'secret' } })
    utils.container.querySelector('button[type="submit"]').click()
    await vi.waitFor(() => expect(redirect).toHaveBeenCalledWith('/'))
    expect(bodies()).toHaveLength(1)
    expect(bodies()[0]).toMatchObject({ user: 'admin', pass: 'secret' })
  })

  it('submits once when the button is clicked', async () => {
    const utils = render(Login)
    const [user, pass] = utils.container.querySelectorAll('input')
    await fireEvent.input(user, { target: { value: 'admin' } })
    await fireEvent.blur(user)
    await fireEvent.input(pass, { target: { value: 'secret' } })
    await fireEvent.blur(pass)
    await fireEvent.click(utils.getByText('login.submit'))
    await vi.waitFor(() => expect(redirect).toHaveBeenCalledWith('/'))
    expect(bodies()).toHaveLength(1)
    expect(bodies()[0]).toMatchObject({ user: 'admin', pass: 'secret' })
  })

  it('says so when the device refuses the credentials', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401 })
    const utils = render(Login)
    await fireEvent.click(utils.getByText('login.submit'))
    await vi.waitFor(() => expect(utils.getByRole('alert')).toHaveTextContent('login.invalid'))
    expect(redirect).not.toHaveBeenCalled()
  })

  it('shows a refusal in the theme error colour, which is legible in light mode', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401 })
    const utils = render(Login)
    await fireEvent.click(utils.getByText('login.submit'))
    await vi.waitFor(() => expect(utils.getByRole('alert')).toHaveClass('text-error'))
  })

  it('labels both fields so password managers can fill them', () => {
    const { getByLabelText } = render(Login)
    const user = getByLabelText('login.username')
    const pass = getByLabelText('login.password')
    expect(user).toHaveAttribute('autocomplete', 'username')
    expect(user).toHaveAttribute('name', 'username')
    expect(pass).toHaveAttribute('autocomplete', 'current-password')
    expect(pass).toHaveAttribute('name', 'password')
  })

  it('names the charger being signed in to', () => {
    const { getByText } = render(Login)
    expect(getByText(`login.subtitle_host:${JSON.stringify({ host: location.hostname })}`)).toBeInTheDocument()
  })
})
