<script lang="ts">
  import { _ } from 'svelte-i18n'
  import type { ChargerStatus, StatusTone } from '../../dashboard/status'

  // What the charger is doing and why, in the same spot above the hero in
  // every state. Screen readers hear it through the Dashboard's persistent
  // live region, not this element, which is remounted when the hero swaps.
  interface Props {
    status: ChargerStatus
  }
  let { status }: Props = $props()

  const TEXT: Record<StatusTone, string> = {
    charging: 'text-charging',
    success: 'text-success',
    accent: 'text-accent',
    sleep: 'text-sleep',
    dim: 'text-text-dim',
    error: 'text-error',
  }
  const DOT: Record<StatusTone, string> = {
    charging: 'bg-charging',
    success: 'bg-success',
    accent: 'bg-accent',
    sleep: 'bg-sleep',
    dim: 'bg-text-dim',
    error: 'bg-error',
  }
</script>

<div class="min-w-0" data-status-line>
  <p class="flex flex-wrap items-center gap-x-2 text-[15px] font-bold leading-snug {TEXT[status.tone]}">
    <span class="inline-flex items-center gap-2">
      <span aria-hidden="true" class="h-2 w-2 shrink-0 rounded-full {DOT[status.tone]}"></span>
      <span>{$_(status.headline.key)}</span>
    </span>
    {#if status.plug}
      <span class="text-[13px] font-medium text-text-dim">{$_(status.plug.key)}</span>
    {/if}
  </p>
  {#if status.reason}
    <p class="text-[13px] leading-snug text-text-dim">{$_(status.reason.key, { values: status.reason.values })}</p>
  {/if}
  {#if status.next}
    <p class="text-[13px] font-medium leading-snug text-text">{$_(status.next.key, { values: status.next.values })}</p>
  {/if}
</div>
