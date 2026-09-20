<script lang="ts">
  import { _ } from 'svelte-i18n'
  import Modal from '../ui/Modal.svelte'
  import Button from '../ui/Button.svelte'
  import SegmentedControl from '../ui/SegmentedControl.svelte'
  import DayPicker from './DayPicker.svelte'
  import { daysToFlags, flagsToDays, hasAnyDay, DAYS } from '../../schedule/timers'
  import type { Timer } from '../../schedule/timers'

  interface Props {
    open?: boolean
    timer?: Timer | null
    busy?: boolean
    onclose?: () => void
    onsave?: (data: Pick<Timer, 'state' | 'time' | 'days'>) => void
  }
  let { open = false, timer = null, busy = false, onclose = () => {}, onsave = () => {} }: Props = $props()

  let flags = $state(DAYS.map(() => true))
  let time = $state('08:00')
  let timerState = $state('active')
  let showDayError = $state(false)

  $effect(() => {
    if (open) {
      flags = timer ? daysToFlags(timer.days) : DAYS.map(() => true)
      time = timer?.time ?? '08:00'
      timerState = timer?.state ?? 'active'
      showDayError = false
    }
  })

  let stateOptions = $derived([
    { value: 'active', label: $_('schedule.active') },
    { value: 'disabled', label: $_('schedule.disabled') },
  ])

  function save(): void {
    if (!hasAnyDay(flags)) {
      showDayError = true
      return
    }
    onsave({ state: timerState, time, days: flagsToDays(flags) })
  }

  // SegmentedControl emits string | number (its value union is shared with
  // Select); every option here is string-valued, so this is always a string —
  // named so the narrowing lives in the script, not the markup.
  function pickState(value: string | number): void {
    timerState = String(value)
  }
</script>

<Modal visible={open} closable={!busy} {onclose}>
  <h2 class="mb-4 text-base font-semibold text-text">
    {timer ? $_('schedule.edit_title') : $_('schedule.new_title')}
  </h2>

  <DayPicker {flags} onchange={(f) => { flags = f; showDayError = false }} />
  {#if showDayError}
    <p class="mt-2 text-xs text-error">{$_('schedule.error_no_day')}</p>
  {/if}

  <label class="mt-4 block">
    <span class="mb-1 block text-[10px] tracking-wide text-text-dim uppercase">{$_('schedule.time')}</span>
    <input
      type="time"
      bind:value={time}
      class="block w-full min-w-0 appearance-none rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-text"
    />
  </label>

  <div class="mt-4">
    <span class="mb-1 block text-[10px] tracking-wide text-text-dim uppercase">{$_('schedule.state')}</span>
    <SegmentedControl options={stateOptions} value={timerState} onchange={pickState} />
  </div>

  <div class="mt-5 flex gap-2">
    <Button label={$_('schedule.save')} disabled={busy} onclick={save} />
    <Button label={$_('schedule.cancel')} variant="ghost" disabled={busy} onclick={onclose} />
  </div>
</Modal>
