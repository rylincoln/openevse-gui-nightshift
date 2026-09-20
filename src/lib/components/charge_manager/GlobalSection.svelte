<script lang="ts">
  import { _ } from 'svelte-i18n'
  import GlobalFeatureCard from './GlobalFeatureCard.svelte'
  import TempProtectionCard from './TempProtectionCard.svelte'
  import type { Limit } from '../../api/device'

  /** Temperature-protection view-model built by ChargeManager.svelte from config. */
  interface TempProtectionInfo {
    throttle: number
    panic: number
    min: number
    max: number
    checksAllOn: boolean
    temperature: number | null
  }

  interface Props {
    enabledFeatures?: string[]
    limit?: Limit
    removingKey?: string | null
    busy?: boolean
    // Temperature protection (rendered at the top when throttling is enabled).
    tempProtection?: TempProtectionInfo | null
    // display unit for temp labels: 'c' | 'f'
    tempUnit?: string
    // called with featureKey
    onedit?: (key: string) => void
    // called with featureKey
    onremove?: (key: string) => void
    onThrottleChange?: (celsius: number) => void
    onPanicChange?: (celsius: number) => void
  }
  let {
    enabledFeatures = [],
    limit = { type: 'none', value: 0, auto_release: true },
    removingKey = null,
    busy = false,
    tempProtection = null,
    tempUnit = 'c',
    onedit = () => {},
    onremove = () => {},
    onThrottleChange = () => {},
    onPanicChange = () => {},
  }: Props = $props()
</script>

<div class="mb-6">
  <div class="mb-2">
    <h2 class="text-sm font-semibold uppercase tracking-wide text-text-dim">
      {$_('charge_manager.global_section')}
    </h2>
  </div>

  {#if tempProtection}
    <TempProtectionCard
      title={$_('charge_manager.safety')}
      throttle={tempProtection.throttle}
      panic={tempProtection.panic}
      min={tempProtection.min}
      max={tempProtection.max}
      checksAllOn={tempProtection.checksAllOn}
      temperature={tempProtection.temperature}
      unit={tempUnit}
      {busy}
      {onThrottleChange}
      {onPanicChange}
    />
  {/if}

  {#if enabledFeatures.length === 0 && !tempProtection}
    <p class="text-sm text-text-dim">{$_('charge_manager.global_empty')}</p>
  {:else}
    {#each enabledFeatures as key (key)}
      <GlobalFeatureCard
        featureKey={key}
        {limit}
        {busy}
        removing={removingKey === key}
        onedit={() => onedit(key)}
        onremove={() => onremove(key)}
      />
    {/each}
  {/if}
</div>
