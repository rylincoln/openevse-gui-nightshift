<script lang="ts">
  import { _ } from 'svelte-i18n'
  import type { MetricRowModel } from '../../monitoring/metrics'

  interface Props extends MetricRowModel {}
  let { labelKey, value, unit = '', textKey = '' }: Props = $props()

  let display = $derived(
    textKey ? $_(textKey)
    : value === null || value === undefined ? '—'
    : value,
  )
</script>

<div class="flex items-center justify-between py-2 text-sm">
  <span class="text-text-dim">{$_(labelKey)}</span>
  <span class="font-semibold text-text">
    {display}{#if unit && display !== '—'}<span class="ml-1 text-xs font-normal text-text-dim">{$_(unit)}</span>{/if}
  </span>
</div>
