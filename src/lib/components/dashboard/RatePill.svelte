<script lang="ts">
  import { _ } from 'svelte-i18n'
  import Popover from '../ui/Popover.svelte'
  import Slider from '../ui/Slider.svelte'

  interface Props {
    amps?: number
    min?: number
    max?: number
    /** Display name of the client setting the rate, when it isn't the owner. */
    claimedBy?: string
    /** Who is capping the current below this rate, as a sentence. */
    capText?: string
    disabled?: boolean
    onchange?: (value: number) => void
  }
  let {
    amps = 6,
    min = 6,
    max = 48,
    claimedBy = '',
    capText = '',
    disabled = false,
    onchange = () => {},
  }: Props = $props()

  let open = $state(false)
  // Live value while the slider is being dragged (touch gives no hover
  // tooltip, so the header must track the drag). Survives release too — the
  // committed value only round-trips through the device after onchange, and
  // falling back to the stale `amps` prop in the meantime reads as "it
  // ignored me". A failed write remounts the pill (rateNonce), clearing this.
  let liveAmps = $state<number | null>(null)
  let shown = $derived(liveAmps ?? amps)

  function toggle(): void {
    if (disabled) return
    open = !open
  }
</script>

<div class="relative inline-block text-right">
  <button
    type="button"
    {disabled}
    aria-haspopup="dialog"
    aria-expanded={open}
    onclick={toggle}
    class="flex min-h-11 flex-col items-end justify-center rounded-xl border border-border bg-surface-2 px-3 py-1
           disabled:cursor-not-allowed"
    class:opacity-40={disabled}
  >
    <span class="text-[11px] font-medium leading-tight text-text-dim">{$_('dashboard.rate.label')}</span>
    <span class="whitespace-nowrap text-[15px] font-bold leading-tight text-text"
      >{shown} A <span aria-hidden="true" class="text-xs">▾</span></span
    >
  </button>

  <Popover {open} align="right" label={$_('dashboard.rate.label')} onclose={() => (open = false)}>
    <div class="w-64 rounded-xl border border-border bg-surface-2 p-3 text-left shadow-xl">
      <div class="mb-2 flex items-baseline justify-between">
        <span class="text-sm font-bold text-text">{$_('dashboard.rate.label')}</span>
        <span class="text-sm font-bold text-accent">{shown} A</span>
      </div>
      <Slider
        {min}
        {max}
        step={1}
        value={amps}
        ariaLabel={$_('dashboard.rate.label')}
        format={(v) => `${v} A`}
        showBubble={false}
        oninput={(v) => (liveAmps = v)}
        {onchange}
      />
      {#if claimedBy}
        <p class="mt-2 text-xs text-text-dim">{$_('dashboard.rate.claimed', { values: { client: claimedBy } })}</p>
      {/if}
      {#if capText}
        <p class="mt-1 text-xs font-medium text-warning">{capText}</p>
      {/if}
    </div>
  </Popover>
</div>
