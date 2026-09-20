<script lang="ts">
  import type { Component as SvelteComponent } from 'svelte'
  import { currentPath, redirect } from '../router'

  interface Props {
    routes?: Record<string, SvelteComponent>
    fallback?: SvelteComponent
    aliases?: Record<string, string>
  }
  let { routes = {}, fallback, aliases = {} }: Props = $props()

  // A legacy path renders nothing for the one tick it takes the redirect
  // to land — never the fallback, which would flash a 404.
  let Component = $derived<SvelteComponent | null | undefined>(
    routes[$currentPath] ?? (aliases[$currentPath] ? null : fallback),
  )

  $effect(() => {
    const target = aliases[$currentPath]
    if (target) redirect(target)
  })
</script>

{#if Component}
  <Component />
{/if}
