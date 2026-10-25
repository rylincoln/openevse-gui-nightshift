import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'
import { createRawSnippet } from 'svelte'

import Modal from '../Modal.svelte'

const content = createRawSnippet(() => ({
  render: () => `<div><h2>Delete rule?</h2><p data-testid="body">It stops at once.</p><button>Delete</button></div>`,
}))

// jsdom has no showModal(), so these run the fallback path; the focus trap
// and backdrop that showModal() adds are browser behaviour, not tested here.
describe('Modal', () => {
  let opener
  afterEach(() => opener?.remove())

  function focusOpener() {
    opener = document.createElement('button')
    opener.textContent = 'Open'
    document.body.appendChild(opener)
    opener.focus()
    return opener
  }

  it('renders nothing when not visible', () => {
    const { queryByRole } = render(Modal, { props: { visible: false, children: content } })
    expect(queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('is named by its heading', () => {
    const { getByRole } = render(Modal, { props: { visible: true, children: content } })
    expect(getByRole('dialog', { name: 'Delete rule?' })).toBeInTheDocument()
  })

  it('takes the alertdialog role when asked', () => {
    const { getByRole } = render(Modal, { props: { visible: true, role: 'alertdialog', children: content } })
    expect(getByRole('alertdialog', { name: 'Delete rule?' })).toBeInTheDocument()
  })

  it('moves focus into the dialog when it opens', () => {
    focusOpener()
    const { getByRole } = render(Modal, { props: { visible: true, children: content } })
    expect(getByRole('dialog').contains(document.activeElement)).toBe(true)
  })

  it('returns focus to the element that opened it when it closes', async () => {
    const button = focusOpener()
    const { rerender } = render(Modal, { props: { visible: true, children: content } })
    expect(document.activeElement).not.toBe(button)
    await rerender({ visible: false })
    expect(document.activeElement).toBe(button)
  })

  it('calls onclose on Escape when closable', async () => {
    const onclose = vi.fn()
    const { getByRole } = render(Modal, { props: { visible: true, onclose, children: content } })
    await fireEvent.keyDown(getByRole('dialog'), { key: 'Escape' })
    expect(onclose).toHaveBeenCalledOnce()
  })

  it('swallows Escape when not closable, so the browser cannot close it either', async () => {
    const onclose = vi.fn()
    const { getByRole } = render(Modal, { props: { visible: true, closable: false, onclose, children: content } })
    const notCancelled = await fireEvent.keyDown(getByRole('dialog'), { key: 'Escape' })
    expect(notCancelled).toBe(false)
    expect(onclose).not.toHaveBeenCalled()
  })

  it('treats a cancel request (e.g. the Android back button) like Escape', async () => {
    const onclose = vi.fn()
    const { getByRole } = render(Modal, { props: { visible: true, onclose, children: content } })
    const cancel = new Event('cancel', { cancelable: true })
    getByRole('dialog').dispatchEvent(cancel)
    expect(cancel.defaultPrevented).toBe(true)
    expect(onclose).toHaveBeenCalledOnce()
  })

  it('reopens a non-closable dialog the browser closed anyway', async () => {
    const { getByRole } = render(Modal, { props: { visible: true, closable: false, children: content } })
    const dialog = getByRole('dialog')
    dialog.removeAttribute('open')
    dialog.dispatchEvent(new Event('close'))
    expect(dialog.hasAttribute('open')).toBe(true)
  })

  it('closes on a backdrop click but not on a click inside', async () => {
    const onclose = vi.fn()
    const { getByRole, getByTestId } = render(Modal, { props: { visible: true, onclose, children: content } })
    await fireEvent.click(getByTestId('body'))
    expect(onclose).not.toHaveBeenCalled()
    // A click on the ::backdrop is dispatched to the <dialog> itself.
    await fireEvent.click(getByRole('dialog'))
    expect(onclose).toHaveBeenCalledOnce()
  })

  it('ignores a backdrop click when not closable', async () => {
    const onclose = vi.fn()
    const { getByRole } = render(Modal, { props: { visible: true, closable: false, onclose, children: content } })
    await fireEvent.click(getByRole('dialog'))
    expect(onclose).not.toHaveBeenCalled()
  })
})
