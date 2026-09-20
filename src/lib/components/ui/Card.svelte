<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    class?: string
    children?: Snippet
  }
  let { class: klass = '', children }: Props = $props()
</script>

<div class="rounded-2xl bg-surface-2 {klass}">
  {@render children?.()}
</div>
