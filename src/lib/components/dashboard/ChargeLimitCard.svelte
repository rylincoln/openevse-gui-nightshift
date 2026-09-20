<script lang="ts">
  import { _ } from 'svelte-i18n'
  import VehicleSocBar from './VehicleSocBar.svelte'
  import LimitSliderBar from './LimitSliderBar.svelte'
  import type { Limit, LimitType } from '../../api/device'

  interface Props {
    // vehicle-bar inputs
    hasSoc?: boolean
    soc?: number
    vehicleLimit?: number | null
    target?: number
    range?: number | null
    rangeMiles?: boolean
    timeToFull?: number
    charging?: boolean
    estMaxRange?: number | null
    disabled?: boolean
    ontarget?: (value: number) => void
    onunit?: (unit: 'percent' | 'range') => void
    // limit state + inline editors
    limit?: Limit
    elapsedSec?: number
    sessionWh?: number
    systemLimit?: boolean
    maxEnergyKwh?: number
    onlimit?: (data: { type: LimitType; value: number }) => void
  }
  let {
    // vehicle-bar inputs
    hasSoc = false,
    soc = 0,
    vehicleLimit = null,
    target = 80,
    range = null,
    rangeMiles = false,
    timeToFull = 0,
    charging = false,
    estMaxRange = null,
    disabled = false,
    ontarget = () => {},
    onunit = () => {},
    // limit state + inline editors
    limit = { type: 'none' } as Limit,
    elapsedSec = 0,
    sessionWh = 0,
    systemLimit = false,
    maxEnergyKwh = 100,
    onlimit = () => {},
  }: Props = $props()

  // The card's own pill ids — every non-'none' LimitType this editor offers.
  type LimitPillId = Exclude<LimitType, 'none'>

  let canRange = $derived(hasSoc && Number.isFinite(estMaxRange))
  let pills = $derived([
    ...(hasSoc ? [{ id: 'soc' as LimitPillId, labelKey: 'dashboard.limit.type_soc' }] : []),
    ...(canRange ? [{ id: 'range' as LimitPillId, labelKey: 'dashboard.limit.type_range' }] : []),
    { id: 'time' as LimitPillId, labelKey: 'dashboard.limit.type_time' },
    { id: 'energy' as LimitPillId, labelKey: 'dashboard.limit.type_energy' },
  ])

  // The active limit's pill is the default; a manual pick overrides it (same
  // userUnit pattern as the Dashboard). Clamp to an available pill in case a
  // range limit is active but the range estimate has gone away.
  let activeType = $derived(limit?.type && limit.type !== 'none' ? limit.type : null)
  let userPick = $state<LimitPillId | null>(null)
  let selected = $derived.by(() => {
    const want = userPick ?? activeType ?? (hasSoc ? 'soc' : 'time')
    return pills.some((p) => p.id === want) ? want : pills[0].id
  })

  function pick(id: LimitPillId): void {
    userPick = id
    if (id === 'soc') onunit('percent')
    else if (id === 'range') onunit('range')
  }

  // Only the editor of the ACTIVE system limit is read-only; other editors
  // stay usable (committing them overrides the default for this session and
  // leaves the config untouched).
  let editorDisabled = $derived((id: LimitPillId) => disabled || (systemLimit && activeType === id))
</script>

{#snippet pillRow()}
  <!-- Rendered inside the editors' header line, right-aligned where the old
       %/km toggle lived — the progress/remaining text keeps the top-left. -->
  <div role="radiogroup" aria-label={$_('dashboard.limit.pills_aria')} class="flex shrink-0 flex-wrap justify-end gap-1.5">
    {#each pills as pill}
      <button
        type="button"
        role="radio"
        aria-checked={selected === pill.id}
        onclick={() => pick(pill.id)}
        class="relative rounded-full border px-3 py-1 text-[11px] font-semibold transition
               {selected === pill.id
                 ? 'border-accent text-accent'
                 : 'border-border text-text-dim'}"
      >
        {$_(pill.labelKey)}
        {#if activeType === pill.id}
          <span data-active-dot class="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-accent"></span>
        {/if}
      </button>
    {/each}
  </div>
{/snippet}

<div class="mt-3 rounded-xl bg-surface-2 px-3 py-3">
  {#if selected === 'soc' || selected === 'range'}
    <VehicleSocBar
      {soc}
      {vehicleLimit}
      {target}
      {range}
      {rangeMiles}
      {timeToFull}
      {charging}
      unit={selected === 'range' ? 'range' : 'percent'}
      {estMaxRange}
      disabled={editorDisabled(selected)}
      onchange={ontarget}
      headerEnd={pillRow}
    />
  {:else}
    <LimitSliderBar
      kind={selected}
      value={activeType === selected ? (limit?.value ?? 0) : 0}
      progress={selected === 'time' ? elapsedSec : sessionWh}
      {maxEnergyKwh}
      {charging}
      disabled={editorDisabled(selected)}
      onchange={(v) => onlimit({ type: selected, value: v })}
      headerEnd={pillRow}
    />
  {/if}
</div>
