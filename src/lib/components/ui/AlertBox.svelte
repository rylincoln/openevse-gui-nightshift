<script lang="ts">
  import Modal from './Modal.svelte'
  import Button from './Button.svelte'

  interface Props {
    visible?: boolean
    title?: string
    body?: string
    button?: boolean
    label?: string
    closable?: boolean
    action?: () => void
    onclose?: () => void
  }
  let {
    visible = false,
    title = '',
    body = '',
    button = false,
    label = 'OK',
    closable = true,
    action = () => {},
    onclose = () => {},
  }: Props = $props()
</script>

<Modal {visible} {closable} {onclose}>
  <h2 class="text-base font-semibold text-text">{title}</h2>
  <p class="mt-2 text-sm text-text-dim">{body}</p>
  {#if button}
    <div class="mt-4">
      <Button {label} onclick={action} />
    </div>
  {/if}
</Modal>
