<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    visible?: boolean
    closable?: boolean
    // 'sm' (default, dialogs) | 'md' (roomier dialogs) | 'lg' (live consoles, big content)
    size?: 'sm' | 'md' | 'lg'
    // 'alertdialog' for messages that interrupt the user (errors, lost connection)
    role?: 'dialog' | 'alertdialog'
    // id of the element holding the message, for an alertdialog
    describedby?: string
    onclose?: () => void
    children?: Snippet
  }
  let {
    visible = false,
    closable = true,
    size = 'sm',
    role = 'dialog',
    describedby,
    onclose = () => {},
    children,
  }: Props = $props()

  const uid = $props.id()

  const widths = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-4xl',
  }

  // Opens the dialog modally, names it after its first heading, and hands
  // focus back to whatever had it when the dialog goes away. showModal()
  // puts the dialog in the top layer (above the loader and every z-index),
  // makes the page behind it inert and moves focus to the first control;
  // the fallback for browsers without it just shows the dialog.
  function modal(node: HTMLDialogElement) {
    const opener = document.activeElement as HTMLElement | null
    const heading = node.querySelector('h1, h2, h3')
    if (heading) {
      heading.id ||= `${uid}-title`
      node.setAttribute('aria-labelledby', heading.id)
    }
    open(node)
    if (!node.contains(document.activeElement)) node.focus()
    // Runs after the dialog has left the document, so the page is no longer
    // inert and the opener can take focus again.
    return () => {
      if (opener?.isConnected) opener.focus()
    }
  }

  function open(node: HTMLDialogElement): void {
    if (typeof node.showModal === 'function') node.showModal()
    else node.setAttribute('open', '')
  }

  // Esc is handled here rather than on `cancel`: a browser lets a page refuse
  // only one cancel in a row, and closes the dialog on the next Esc anyway.
  function onkeydown(e: KeyboardEvent): void {
    if (e.key !== 'Escape') return
    e.preventDefault()
    if (closable) onclose()
  }

  // Other close requests (the Android back button) arrive as `cancel`.
  function oncancel(e: Event): void {
    e.preventDefault()
    if (closable) onclose()
  }

  // The browser closed it despite the refused cancel: follow it, or put a
  // dialog that must stay up straight back.
  function onnativeclose(e: Event): void {
    const node = e.currentTarget as HTMLDialogElement
    if (!node.isConnected) return
    if (closable) onclose()
    else open(node)
  }
</script>

{#if visible}
  <!-- A click on the ::backdrop is dispatched to the <dialog> itself; the
       content wrapper fills the dialog, so any click inside hits a child. -->
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
  <dialog
    {@attach modal}
    class="fixed inset-0 z-40 m-auto h-fit max-h-[calc(100%-3rem)] w-[calc(100%-3rem)] {widths[size]} overflow-auto rounded-2xl border-0 bg-surface-2 p-0 text-text shadow-xl backdrop:bg-black/55"
    {role}
    aria-describedby={describedby}
    tabindex="-1"
    {onkeydown}
    {oncancel}
    onclose={onnativeclose}
    onclick={(e) => closable && e.target === e.currentTarget && onclose()}
  >
    <div class="p-5">
      {@render children?.()}
    </div>
  </dialog>
{/if}
