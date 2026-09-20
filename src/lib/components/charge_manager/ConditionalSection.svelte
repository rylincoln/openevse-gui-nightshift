<script lang="ts">
  import { _ } from 'svelte-i18n'
  import RuleCard from './RuleCard.svelte'
  import type { Rule } from '../../charge_manager/rules'

  interface Props {
    rules?: Rule[]
    removingId?: string | null
    // firmware's currently-active schedule event id
    activeEventId?: number | null
    busy?: boolean
    // called with rule object
    onedit?: (rule: Rule) => void
    // called with rule object
    ondelete?: (rule: Rule) => void
  }
  let {
    rules = [],
    removingId = null,
    activeEventId = null,
    busy = false,
    onedit = () => {},
    ondelete = () => {},
  }: Props = $props()
</script>

<div class="mb-4">
  <div class="mb-2 flex items-baseline justify-between">
    <h2 class="text-sm font-semibold uppercase tracking-wide text-text-dim">
      {$_('charge_manager.conditional_section')}
    </h2>
  </div>

  {#if rules.length === 0}
    <p class="text-sm text-text-dim">{$_('charge_manager.conditional_empty')}</p>
  {:else}
    {#each rules as rule (rule.id)}
      <RuleCard
        {rule}
        active={activeEventId != null && rule._startEventId === activeEventId}
        removing={removingId === rule.id}
        disabled={busy}
        onedit={() => onedit(rule)}
        ondelete={() => ondelete(rule)}
      />
    {/each}
  {/if}
</div>
