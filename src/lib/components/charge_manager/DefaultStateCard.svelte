<script lang="ts">
  import { _ } from 'svelte-i18n'
  import Card from '../ui/Card.svelte'
  import Slider from '../ui/Slider.svelte'
  import IconButton from '../ui/IconButton.svelte'
  import Icon from '../../icons/Icon.svelte'

  import { untrack } from 'svelte'

  interface Props {
    current?: number
    minCurrent?: number
    maxCurrent?: number
    busy?: boolean
    // Status indicators (the switches themselves live in the settings page).
    heartbeatSupported?: boolean
    heartbeatActive?: boolean // red heart when heartbeat supervision is on
    bootLockSupported?: boolean // show the lock/unlock icon at all
    bootLock?: boolean // locked padlock when on, open padlock when off
    onCurrentChange?: (amps: number) => void
    onEdit?: () => void // open the settings page
  }
  let {
    current     = 32,
    minCurrent  = 6,
    maxCurrent  = 32,
    busy        = false,
    heartbeatSupported = false,
    heartbeatActive    = false,
    bootLockSupported  = false,
    bootLock           = false,
    onCurrentChange = () => {},
    onEdit          = () => {},
  }: Props = $props()

  // Live value shown large above the slider — tracks the thumb while dragging.
  let liveCurrent = $state(untrack(() => current))
  $effect(() => { liveCurrent = current })
</script>

<Card class="mb-3 p-4">
  <!-- Header: title · status icons (heart / lock) · edit pencil -->
  <div class="flex items-center justify-between gap-3">
    <div class="text-sm font-semibold text-text">{$_('charge_manager.station')}</div>
    <div class="flex items-center gap-2">
      {#if heartbeatSupported}
        <!-- grid place-items-center matches the pencil IconButton's centering so
             these status icons sit on the same baseline. Without it the icon's
             default vertical-align (-0.125em on iconify-icon) shifts it off centre
             relative to the grid-centred pencil button. -->
        <span
          role="img"
          aria-label={$_('config.security.heartbeat')}
          class="grid place-items-center {heartbeatActive ? 'text-error' : 'text-text-dim'}"
        >
          <Icon icon={heartbeatActive ? 'mdi:heart' : 'mdi:heart-outline'} size={18} />
        </span>
      {/if}
      {#if bootLockSupported}
        <span
          role="img"
          aria-label={$_('config.security.boot_lock')}
          class="grid place-items-center {bootLock ? 'text-text' : 'text-text-dim'}"
        >
          <Icon icon={bootLock ? 'mdi:lock' : 'mdi:lock-open-variant'} size={18} />
        </span>
      {/if}
      <IconButton
        icon="mdi:pencil-outline"
        size={18}
        label={$_('charge_manager.default_state_settings')}
        disabled={busy}
        onclick={onEdit}
      />
    </div>
  </div>

  <!-- Current — large live set point, no popup, tight to the slider -->
  <div class="mt-3">
    <div class="text-[10px] uppercase tracking-wide text-text-dim">{$_('charge_manager.current')}</div>
    <div class="text-3xl font-bold leading-tight tabular-nums text-text">
      {liveCurrent}<span class="ml-1 text-xl font-semibold text-text-dim">A</span>
    </div>
    <Slider
      min={minCurrent}
      max={maxCurrent}
      step={1}
      value={current}
      disabled={busy}
      showBubble={false}
      ariaLabel={$_('charge_manager.current')}
      oninput={(v) => (liveCurrent = v)}
      onchange={onCurrentChange}
    />
    <div class="mt-1 flex justify-between text-[10px] text-text-dim">
      <span>{minCurrent} A</span>
      <span>{maxCurrent} A</span>
    </div>
  </div>
</Card>
