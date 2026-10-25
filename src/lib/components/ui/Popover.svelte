<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    open?: boolean
    align?: 'left' | 'right'
    /** Accessible name of the panel. */
    label?: string
    onclose?: () => void
    children?: Snippet
  }
  let { open = false, align = 'left', label = '', onclose = () => {}, children }: Props = $props()

  function onKey(e: KeyboardEvent): void {
    if (open && e.key === 'Escape') onclose()
  }

  const FOCUSABLE = 'input:not([disabled]), button:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

  // A small non-modal dialog: focus moves to its first control on open, and
  // back to whatever had it on close, unless the user has moved on by then.
  function panel(node: HTMLElement) {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    ;(node.querySelector<HTMLElement>(FOCUSABLE) ?? node).focus()
    return () => {
      const active = document.activeElement
      const stillHere = !active || active === document.body || node.contains(active)
      if (stillHere && opener?.isConnected) opener.focus()
    }
  }
</script>

<svelte:window onkeydown={onKey} />

{#if open}
  <!-- full-viewport transparent catcher for click-outside (mirrors Modal.svelte) -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="fixed inset-0 z-40" role="presentation" onclick={onclose}></div>
  <div
    {@attach panel}
    class="absolute top-full z-50 mt-1 {align === 'right' ? 'right-0' : 'left-0'}"
    role="dialog"
    aria-label={label || undefined}
    tabindex="-1"
  >
    {@render children?.()}
  </div>
{/if}
