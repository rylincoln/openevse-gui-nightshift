<!-- src/lib/components/config/FormField.svelte -->
<script lang="ts">
  import type { Snippet } from 'svelte'
  import Icon from '../../icons/Icon.svelte'
  import type { SaveStatus } from '../../config/saveState'

  interface Props {
    label?: string
    description?: string
    status?: SaveStatus
    // `badge` is an optional snippet rendered immediately after the label — the
    // slot an advisory marker sits in, beside the very switch it is about.
    badge?: Snippet
    children?: Snippet
  }
  let { label = '', description = '', status = 'idle', badge, children }: Props = $props()

  const uid = $props.id()
  const labelId = `${uid}-label`
  const descriptionId = `${uid}-description`

  // The control arrives as a snippet, so it can't take a for/id pair from
  // here. Point the first form control at the label (and description)
  // instead, unless something already names it. Buttons beside the control
  // ("Test", "Scan") keep their own text. Re-run when the slot's contents
  // change, since some fields swap their control in later.
  const CONTROL =
    'input:not([type="hidden"]), select, textarea, [role="switch"], [role="slider"], [role="combobox"], [role="spinbutton"]'

  function link(slot: HTMLElement) {
    const apply = () => {
      const control = slot.querySelector<HTMLElement>(CONTROL)
      if (!control) return
      const named =
        !!control.getAttribute('aria-label')?.trim() ||
        control.hasAttribute('aria-labelledby') ||
        !!(control as HTMLInputElement).labels?.length
      if (!named) control.setAttribute('aria-labelledby', labelId)
      const described = control.getAttribute('aria-describedby')?.split(/\s+/) ?? []
      if (description && !described.includes(descriptionId)) {
        control.setAttribute('aria-describedby', [...described, descriptionId].join(' '))
      }
    }
    apply()
    const observer = new MutationObserver(apply)
    observer.observe(slot, { childList: true, subtree: true })
    return () => observer.disconnect()
  }
</script>

<div class="py-3">
  <div class="flex items-center justify-between gap-3">
    <span class="flex min-w-0 items-center gap-2">
      <span id={labelId} class="text-sm text-text">{label}</span>
      {@render badge?.()}
    </span>
    {#if status === 'saving'}
      <Icon icon="mdi:loading" size={16} class="animate-spin text-text-dim" />
    {:else if status === 'saved'}
      <Icon icon="mdi:check" size={16} class="text-accent" />
    {:else if status === 'error'}
      <Icon icon="mdi:alert-circle-outline" size={16} class="text-error" />
    {/if}
  </div>
  <div class="mt-1.5" {@attach link}>{@render children?.()}</div>
  {#if description}
    <p id={descriptionId} class="mt-1 text-xs text-text-dim">{description}</p>
  {/if}
</div>
