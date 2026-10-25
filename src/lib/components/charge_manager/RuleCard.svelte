<script lang="ts">
  import { _, locale } from 'svelte-i18n'
  import Card from '../ui/Card.svelte'
  import IconButton from '../ui/IconButton.svelte'
  import ConfirmDialog from '../ui/ConfirmDialog.svelte'
  import Icon from '../../icons/Icon.svelte'
  import { formatDayChips } from '../../schedule/timers'
  import { isNextDay } from '../../charge_manager/rules'
  import { formatClock } from '../../format/clock'
  import type { Rule, RuleLimit } from '../../charge_manager/rules'

  interface Props {
    rule: Rule
    active?: boolean
    removing?: boolean
    disabled?: boolean
    onedit?: () => void
    ondelete?: () => void
  }
  let { rule, active = false, removing = false, disabled = false, onedit = () => {}, ondelete = () => {} }: Props = $props()

  let chips  = $derived(formatDayChips(rule?.days))

  // An open-ended rule has no stop of its own: it runs until the next rule
  // starts, which the week strip above the list shows.
  let window = $derived.by(() => {
    const start = formatClock(rule?.startTime, $locale)
    if (!rule?.stopTime) return $_('charge_manager.window_open', { values: { start } })
    const key = isNextDay(rule.startTime, rule.stopTime) ? 'window_next_day' : 'window'
    return $_(`charge_manager.${key}`, { values: { start, stop: formatClock(rule.stopTime, $locale) } })
  })

  function actionLabel(action: string): string {
    return $_('charge_manager.rule_action_' + action, { default: action })
  }

  // The title carries the rate a charge rule sets: "Charge at 16 A".
  let title = $derived(
    (rule?.chargeCurrent ?? 0) > 0
      ? $_('charge_manager.rule_title_rate', { values: { action: actionLabel(rule.action), amps: rule.chargeCurrent } })
      : actionLabel(rule?.action),
  )

  // What tells this rule's buttons apart from every other rule's.
  let name = $derived(
    [title, chips.filter((c) => c.on).map((c) => $_('days.' + c.day)).join(' '), window].join(', '),
  )

  let confirmDelete = $state(false)

  function limitLabel(limit: RuleLimit | null | undefined): string | null {
    if (!limit || limit.type === 'none' || !limit.value) return null
    if (limit.type === 'time') {
      const mins = limit.value
      return mins >= 60 ? `${Math.round(mins / 60)} h` : `${mins} min`
    }
    if (limit.type === 'energy') return `${Math.round(limit.value / 1000)} kWh`
    if (limit.type === 'soc')    return `${limit.value}%`
    return null
  }

  let limitChip = $derived(limitLabel(rule?.limit))
</script>

<Card class="mb-3 p-4">
  <div class="flex items-start justify-between gap-2">
    <!-- Left: action title + schedule details -->
    <button type="button" onclick={onedit} class="min-w-0 flex-1 text-left">
      <div class="flex items-center gap-2">
        <div class="text-sm font-semibold text-text">
          {title}
        </div>
        {#if active}
          <span class="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-semibold text-success">
            <span class="h-1.5 w-1.5 rounded-full bg-success"></span>
            {$_('charge_manager.active')}
          </span>
        {/if}
      </div>

      <div class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        <!-- Day chips -->
        <div class="flex flex-wrap gap-1">
          {#each chips as chip}
            <span
              class="rounded px-1.5 py-0.5 text-[11px] font-semibold
                     {chip.on ? 'bg-accent/15 text-accent' : 'text-text-dim'}"
            >
              {$_('days.' + chip.day).slice(0, 3)}
            </span>
          {/each}
        </div>
        <!-- Time window -->
        <span class="text-xs text-text-dim">{window}</span>
        <!-- Limit chip -->
        {#if limitChip}
          <span class="rounded-full bg-surface-3 px-2 py-0.5 text-[11px] font-semibold text-text-dim">
            {limitChip}
          </span>
        {/if}
      </div>
    </button>

    <!-- Right: edit + delete -->
    <div class="flex shrink-0 items-center gap-1">
      <IconButton
        icon="mdi:pencil-outline"
        size={16}
        label={$_('charge_manager.rule_edit_named', { values: { rule: name } })}
        {disabled}
        onclick={onedit}
      />
      {#if removing}
        <span class="grid place-items-center p-2 text-text-dim">
          <Icon icon="mdi:loading" size={16} class="motion-safe:animate-spin" />
        </span>
      {:else}
        <IconButton
          icon="mdi:trash-can-outline"
          size={16}
          label={$_('charge_manager.rule_delete_named', { values: { rule: name } })}
          {disabled}
          onclick={() => (confirmDelete = true)}
        />
      {/if}
    </div>
  </div>
</Card>

<ConfirmDialog
  visible={confirmDelete}
  title={$_('charge_manager.rule_delete_title')}
  body={$_('charge_manager.rule_delete_body', { values: { rule: name } })}
  confirmLabel={$_('charge_manager.rule_delete_confirm')}
  cancelLabel={$_('charge_manager.rule_cancel')}
  onconfirm={() => {
    confirmDelete = false
    ondelete()
  }}
  oncancel={() => (confirmDelete = false)}
/>
