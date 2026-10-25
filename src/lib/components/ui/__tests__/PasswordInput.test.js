import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import PasswordInput from '../PasswordInput.svelte'

describe('PasswordInput', () => {
  it('names its reveal button in the page language and says whether it is on', async () => {
    const { getByRole, container } = render(PasswordInput, { props: { value: '' } })
    const button = getByRole('button', { name: 'ui.show_password' })
    expect(button).toHaveAttribute('aria-pressed', 'false')
    await fireEvent.click(button)
    expect(button).toHaveAttribute('aria-pressed', 'true')
    expect(container.querySelector('input')).toHaveAttribute('type', 'text')
  })

  it('passes through the attributes a password manager reads', () => {
    const { container } = render(PasswordInput, {
      props: { id: 'pw', name: 'password', autocomplete: 'current-password' },
    })
    const input = container.querySelector('input')
    expect(input).toHaveAttribute('id', 'pw')
    expect(input).toHaveAttribute('name', 'password')
    expect(input).toHaveAttribute('autocomplete', 'current-password')
  })
})
