import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'
import ConfirmDialog from '../ConfirmDialog.svelte'

const props = {
  visible: true,
  title: 'Restart the controller?',
  body: 'Charging stops while it restarts.',
  confirmLabel: 'Restart',
  cancelLabel: 'Cancel',
}

describe('ConfirmDialog', () => {
  it('renders nothing until it is visible', () => {
    const { queryByRole } = render(ConfirmDialog, { props: { ...props, visible: false } })
    expect(queryByRole('alertdialog')).toBeNull()
  })

  it('is an alert dialog named by its question and described by its consequence', () => {
    const { getByRole } = render(ConfirmDialog, { props })
    const dialog = getByRole('alertdialog', { name: 'Restart the controller?' })
    expect(dialog).toHaveAccessibleDescription('Charging stops while it restarts.')
  })

  it('puts Cancel first, so it takes the focus and Enter does no harm', () => {
    const { getByRole } = render(ConfirmDialog, { props })
    const cancel = getByRole('button', { name: 'Cancel' })
    const confirm = getByRole('button', { name: 'Restart' })
    expect(cancel.compareDocumentPosition(confirm) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('styles the confirm button as destructive', () => {
    const { getByRole } = render(ConfirmDialog, { props })
    expect(getByRole('button', { name: 'Restart' }).className).toContain('text-error')
  })

  it('calls onconfirm or oncancel', async () => {
    const onconfirm = vi.fn()
    const oncancel = vi.fn()
    const { getByRole } = render(ConfirmDialog, { props: { ...props, onconfirm, oncancel } })
    await fireEvent.click(getByRole('button', { name: 'Restart' }))
    expect(onconfirm).toHaveBeenCalledOnce()
    await fireEvent.click(getByRole('button', { name: 'Cancel' }))
    expect(oncancel).toHaveBeenCalledOnce()
  })

  it('cancels on Escape', async () => {
    const oncancel = vi.fn()
    const { getByRole } = render(ConfirmDialog, { props: { ...props, oncancel } })
    await fireEvent.keyDown(getByRole('alertdialog'), { key: 'Escape' })
    expect(oncancel).toHaveBeenCalledOnce()
  })
})
