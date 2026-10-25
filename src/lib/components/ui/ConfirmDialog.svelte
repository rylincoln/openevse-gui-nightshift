<script lang="ts">
  // The one confirmation step in front of an action that erases, removes or
  // interrupts something. It asks a question, says what will happen, and puts
  // Cancel first: the dialog focuses its first control on opening, so Enter
  // on a stray tap does nothing.
  import Modal from './Modal.svelte'
  import Button from './Button.svelte'

  interface Props {
    visible?: boolean
    title?: string
    body?: string
    confirmLabel?: string
    cancelLabel?: string
    busy?: boolean
    onconfirm?: () => void
    oncancel?: () => void
  }
  let {
    visible = false,
    title = '',
    body = '',
    confirmLabel = '',
    cancelLabel = '',
    busy = false,
    onconfirm = () => {},
    oncancel = () => {},
  }: Props = $props()

  const uid = $props.id()
  const bodyId = `${uid}-body`
</script>

<Modal {visible} onclose={oncancel} role="alertdialog" describedby={bodyId}>
  <h2 class="mb-2 text-base font-semibold text-text">{title}</h2>
  <p id={bodyId} class="mb-4 text-sm text-text-dim">{body}</p>
  <div class="flex gap-2">
    <Button label={cancelLabel} variant="ghost" onclick={oncancel} />
    <Button label={confirmLabel} variant="danger" disabled={busy} onclick={onconfirm} />
  </div>
</Modal>
