<script lang="ts">
  interface TabItem {
    label: string
    alert?: boolean
  }
  interface Props {
    tabs?: TabItem[]
    active?: number
    // Both variants are underlined navigation, never filled, so a page tab
    // can't be mistaken for a control that changes the charger. 'primary'
    // (default) is the page-level row; 'subtle' is a smaller row meant to
    // read as a sub-navigation under a primary tab.
    variant?: 'primary' | 'subtle'
    onchange?: (index: number) => void
  }
  let { tabs = [], active = 0, variant = 'primary', onchange = () => {} }: Props = $props()

  let buttons = $state<HTMLButtonElement[]>([])

  // One tab stop for the row; the arrow keys (wrapping), Home and End move
  // between tabs and select them, as the ARIA tabs pattern describes.
  function onkeydown(e: KeyboardEvent, i: number): void {
    const last = tabs.length - 1
    const next =
      e.key === 'ArrowRight' ? (i === last ? 0 : i + 1)
      : e.key === 'ArrowLeft' ? (i === 0 ? last : i - 1)
      : e.key === 'Home' ? 0
      : e.key === 'End' ? last
      : null
    if (next === null) return
    e.preventDefault()
    onchange(next)
    buttons[next]?.focus()
  }
</script>

<div
  class="flex border-b border-border {variant === 'subtle' ? 'gap-5' : ''}"
  role="tablist"
>
  {#each tabs as tab, i}
    <button
      bind:this={buttons[i]}
      type="button"
      role="tab"
      aria-selected={i === active}
      tabindex={i === active ? 0 : -1}
      onclick={() => onchange(i)}
      onkeydown={(e) => onkeydown(e, i)}
      class="relative -mb-px border-b-2 font-semibold transition
             {variant === 'subtle' ? 'tap-target py-1.5 text-xs' : 'min-h-11 flex-1 py-2.5 text-sm'}
             {i === active ? 'border-accent text-text' : 'border-transparent text-text-dim hover:text-text'}"
    >
      {tab.label}
      {#if tab.alert}
        <span class="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-error align-middle"></span>
      {/if}
    </button>
  {/each}
</div>
