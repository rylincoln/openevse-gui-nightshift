<script lang="ts">
  // Who decides each setting right now: whether charging is allowed, the
  // charge rate and any current cap, each with the feature or rule whose
  // claim won it. A setting nobody claims comes from the charger's defaults.
  import { _ } from 'svelte-i18n'
  import Card from '../ui/Card.svelte'
  import { clientid2name } from '../../utils'
  import type { ClaimRow } from '../../monitoring/metrics'

  interface Props {
    rows?: ClaimRow[]
  }
  let { rows = [] }: Props = $props()

  const KNOWN = ['state', 'charge_current', 'max_current']

  function label(property: string): string {
    return KNOWN.includes(property) ? $_(`charge_manager.claims.${property}`) : property
  }

  function value(row: ClaimRow): string {
    if (row.value === 'active') return $_('charge_manager.claims.allowed')
    if (row.value === 'disabled') return $_('charge_manager.claims.off')
    if (row.value === null || row.value === undefined) return '—'
    if (row.property === 'charge_current' || row.property === 'max_current') return `${row.value} A`
    return String(row.value)
  }

  function owner(row: ClaimRow): string {
    const name = clientid2name(row.clientId)
    return name === 'null'
      ? $_('charge_manager.claims.set_by_default')
      : $_('charge_manager.claims.set_by', { values: { client: $_('clients.' + name) } })
  }
</script>

{#if rows.length === 0}
  <Card class="p-4 text-sm text-text-dim">
    {$_('charge_manager.claims.empty')}
  </Card>
{:else}
  <Card class="p-3">
    <dl>
      {#each rows as row}
        <div class="flex items-baseline justify-between gap-3 border-b border-border py-2.5 last:border-0">
          <dt class="text-sm text-text-dim">{label(row.property)}</dt>
          <dd class="text-right">
            <span class="block text-sm font-semibold text-text">{value(row)}</span>
            <span class="block text-xs text-text-dim">{owner(row)}</span>
          </dd>
        </div>
      {/each}
    </dl>
  </Card>
{/if}
