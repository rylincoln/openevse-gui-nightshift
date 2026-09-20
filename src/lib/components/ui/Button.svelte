<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { HTMLButtonAttributes, MouseEventHandler } from 'svelte/elements'

  interface Props {
    label?: string
    variant?: keyof typeof variants
    disabled?: boolean
    type?: HTMLButtonAttributes['type']
    onclick?: MouseEventHandler<HTMLButtonElement>
    children?: Snippet
  }
  let {
    label = '',
    variant = 'primary',
    disabled = false,
    type = 'button',
    onclick = () => {},
    children,
  }: Props = $props()

  const variants = {
    primary: 'bg-accent text-surface',
    ghost: 'bg-transparent text-text border border-border',
  }
</script>

<button
  {type}
  {disabled}
  {onclick}
  class="w-full rounded-2xl px-4 py-3 font-semibold text-sm transition
         disabled:opacity-40 disabled:cursor-not-allowed {variants[variant]}"
>
  {#if children}{@render children()}{:else}{label}{/if}
</button>
