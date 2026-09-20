<!-- src/lib/components/config/ConfigSection.svelte -->
<script lang="ts">
  import type { Snippet } from 'svelte'
  import Card from '../ui/Card.svelte'

  interface Props {
    title?: string
    children?: Snippet
  }
  let { title = '', children }: Props = $props()
</script>

<Card class="mb-4 p-4">
  {#if title}
    <h2 class="mb-1 text-sm font-semibold text-text-dim">{title}</h2>
  {/if}
  {@render children?.()}
</Card>
