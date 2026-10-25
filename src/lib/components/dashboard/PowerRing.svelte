<script lang="ts">
  import { _ } from 'svelte-i18n'
  import ProgressRing from '../ui/ProgressRing.svelte'
  import type { DisplayState } from '../../dashboard/state'

  // The ring is the glanceable half of the hero: kW while charging, otherwise
  // the state's word. Why it is in that state is the status line's job.
  interface Props {
    display?: DisplayState
    fill?: number
    kw?: string
    maxKw?: string
  }
  let { display = 'starting', fill = 0, kw = '0.0', maxKw = '' }: Props = $props()

  // Ring colour tracks the charge state: accent while charging or connected,
  // green when ready, red on a fault, a soft blue while paused, muted grey
  // when manually off. Connected is the car's choice, not a warning.
  let color = $derived(
    display === 'error'
      ? 'var(--error)'
      : display === 'sleeping'
        ? 'var(--sleep)'
        : display === 'off'
          ? 'var(--text-dim)'
          : display === 'idle'
            ? 'var(--success)' // ready: a true green, distinct from the teal accent
            : 'var(--accent)',
  )
  // The status line's headline for each non-charging state.
  const WORD: Record<Exclude<DisplayState, 'charging'>, string> = {
    starting: 'dashboard.line.starting',
    idle: 'dashboard.line.ready',
    connected: 'dashboard.line.connected',
    sleeping: 'dashboard.line.paused',
    off: 'dashboard.line.off',
    error: 'dashboard.line.fault',
  }
  const WORD_COLOR: Record<Exclude<DisplayState, 'charging'>, string> = {
    starting: 'text-text-dim',
    idle: 'text-success',
    connected: 'text-accent',
    sleeping: 'text-sleep',
    off: 'text-text-dim',
    error: 'text-error',
  }
  // While charging the ring shows charge progress; in the ready / connected /
  // fault / paused / off states it becomes a solid colour-coded indicator ring.
  let ringFill = $derived(
    display === 'charging'
      ? fill
      : ['idle', 'connected', 'error', 'sleeping', 'off'].includes(display) ? 1 : 0,
  )
  // Breathe while waiting on something: ready, connected, fault and paused.
  // Off is a deliberate stop — a static ring reinforces that nothing is happening.
  let pulse = $derived(['idle', 'connected', 'error', 'sleeping'].includes(display))
</script>

<div class="flex justify-center py-1">
  <ProgressRing fill={ringFill} {color} {pulse}>
    {#if display === 'charging'}
      <div class="relative h-full w-full">
        <!-- kW value: centered both axes within the ring -->
        <div class="absolute inset-0 grid place-items-center">
          <div class="text-5xl font-extrabold leading-none text-text">{kw}</div>
        </div>
        <!-- KW label + max: stacked just below the centered value -->
        <div class="absolute inset-x-0 top-1/2 flex flex-col items-center pt-6">
          <div class="text-[11px] font-semibold tracking-widest text-accent">KW</div>
          {#if maxKw}
            <div class="mt-0.5 text-[11px] text-text-dim">{$_('dashboard.kw_max', { values: { max: maxKw } })}</div>
          {/if}
        </div>
      </div>
    {:else}
      <div class="flex flex-col items-center px-6 text-center">
        {#if display === 'error'}
          <div aria-hidden="true" class="text-4xl leading-none text-error">⚠</div>
        {/if}
        <div class="text-[22px] font-extrabold leading-none {WORD_COLOR[display]}">{$_(WORD[display])}</div>
      </div>
    {/if}
  </ProgressRing>
</div>
