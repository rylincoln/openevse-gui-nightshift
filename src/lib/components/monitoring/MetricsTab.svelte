<script lang="ts">
  import MetricGroup from './MetricGroup.svelte'
  import type { MetricGroupModel } from '../../monitoring/metrics'

  // Monitoring.svelte builds this as { group, expanded }[], not MetricGroupModel[]
  // directly — expanded is per-group desktop/mobile seed state, carried
  // alongside the group rather than inside it.
  interface Props {
    groups?: { group: MetricGroupModel; expanded?: boolean }[]
  }
  let { groups = [] }: Props = $props()
</script>

<div class="lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-3">
  {#each groups as g}
    <MetricGroup group={g.group} expanded={g.expanded} />
  {/each}
</div>
