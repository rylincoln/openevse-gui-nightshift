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
    heartbeatActive?: boolean // filled heart when heartbeat supervision is on
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
  <!-- Header: title · edit pencil, then the safety settings in words -->
  <div class="flex items-center justify-between gap-3">
    <div class="text-sm font-semibold text-text">{$_('charge_manager.station')}</div>
    <IconButton
      icon="mdi:pencil-outline"
      size={18}
      label={$_('charge_manager.default_state_settings')}
      disabled={busy}
      onclick={onEdit}
    />
  </div>
  {#if heartbeatSupported || bootLockSupported}
    <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-dim">
      {#if heartbeatSupported}
        <span class="flex items-center gap-1">
          <span aria-hidden="true" class="grid place-items-center {heartbeatActive ? 'text-accent' : ''}">
            <Icon icon={heartbeatActive ? 'mdi:heart' : 'mdi:heart-outline'} size={14} />
          </span>
          {$_(heartbeatActive ? 'charge_manager.heartbeat_on' : 'charge_manager.heartbeat_off')}
        </span>
      {/if}
      {#if bootLockSupported}
        <span class="flex items-center gap-1">
          <span aria-hidden="true" class="grid place-items-center {bootLock ? 'text-accent' : ''}">
            <Icon icon={bootLock ? 'mdi:lock' : 'mdi:lock-open-variant'} size={14} />
          </span>
          {$_(bootLock ? 'charge_manager.boot_lock_on' : 'charge_manager.boot_lock_off')}
        </span>
      {/if}
    </div>
  {/if}

  <!-- Current — large live set point, no popup, tight to the slider -->
  <div class="mt-3">
    <div class="text-xs text-text-dim">{$_('charge_manager.current')}</div>
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
    <div class="mt-1 flex justify-between text-[11px] text-text-dim">
      <span>{minCurrent} A</span>
      <span>{maxCurrent} A</span>
    </div>
  </div>
</Card>
