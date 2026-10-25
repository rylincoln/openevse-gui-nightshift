<script lang="ts">
  import { _ } from 'svelte-i18n'
  import Card from '../ui/Card.svelte'
  import Button from '../ui/Button.svelte'
  import ConfirmDialog from '../ui/ConfirmDialog.svelte'
  import { getStateDesc } from '../../utils'
  import { serialQueue } from '../../queue'
  import { httpAPI } from '../../api/httpAPI'
  import { status_store } from '../../stores/status'
  import { config_store } from '../../stores/config'
  import { showWriteError } from '../../alerts'
  import type { SafetyData, SafetyRow, RelayHealthRow } from '../../monitoring/metrics'
  import type { RapiResponse } from '../../api/device'

  interface Props {
    data?: SafetyData
    relay?: RelayHealthRow[] | null
  }
  let { data = { errors: [], infos: [] }, relay = null }: Props = $props()

  const sevClass: Record<string, string> = {
    ok: 'bg-accent/15 text-accent',
    warning: 'bg-warning/15 text-warning',
    error: 'bg-error/15 text-error',
  }

  function rowLabel(row: SafetyRow): string {
    return $_('monitoring.safety.' + row.key)
  }
  function rowValue(row: SafetyRow): string | number | undefined {
    return row.key === 'fault' ? $_(getStateDesc(row.state) ?? '') : row.count
  }

  // The reset waiting on its confirmation, if any.
  let pendingReset = $state<'faults' | 'relay' | null>(null)

  let resetting = $state(false)
  let resetDone = $state(false)

  async function resetFaultCounters(): Promise<void> {
    pendingReset = null
    if (resetting) return
    resetting = true
    resetDone = false
    try {
      // Single-threaded device server — serialize like every other request.
      const res = await serialQueue.add(() => httpAPI<RapiResponse>('GET', '/r?json=1&rapi=$FC'))
      if (res && res !== 'error' && !res.error) {
        resetDone = true
        await status_store.download()
        setTimeout(() => (resetDone = false), 3000)
      } else {
        showWriteError()
      }
    } finally {
      resetting = false
    }
  }

  function relayRowLabel(row: RelayHealthRow): string {
    return $_('monitoring.health.relay.' + row.key)
  }
  function relayRowValue(row: RelayHealthRow): string | number | boolean {
    if (row.value === null || row.value === undefined) {
      return $_('monitoring.health.relay.not_available')
    }
    switch (row.key) {
      case 'life_pct':
      case 'elec_damage':
        return `${row.value}${$_('units.percent')}`
      case 'transit_drift':
        return row.value ? $_('monitoring.health.relay.warning') : $_('monitoring.health.relay.ok')
      case 'transit_baseline':
        return `${row.value} ${$_('units.ms')}`
      case 'thermal_warning':
        return $_(`monitoring.health.relay.level_${row.value}`)
      default:
        return row.value
    }
  }

  let resettingRelay = $state(false)
  let resetRelayDone = $state(false)

  async function resetRelayHealth(): Promise<void> {
    pendingReset = null
    if (resettingRelay) return
    resettingRelay = true
    resetRelayDone = false
    try {
      const res = await serialQueue.add(() => httpAPI<RapiResponse>('GET', '/r?json=1&rapi=$FH'))
      if (res && res !== 'error' && !res.error) {
        resetRelayDone = true
        await config_store.download()
        setTimeout(() => (resetRelayDone = false), 3000)
      } else {
        showWriteError()
      }
    } finally {
      resettingRelay = false
    }
  }
</script>

<!-- Side by side on desktop, as the Data tab is, so a label stays near its value. -->
<div class="lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-3">
  <Card class="mb-2 p-3">
    <h2 class="mb-1 text-sm font-semibold text-text">{$_('monitoring.safety.errors')}</h2>
    {#each data.errors as row}
      <div class="flex items-center justify-between py-2 text-sm">
        <span class="text-text-dim">{rowLabel(row)}</span>
        <span class="rounded-full px-2.5 py-0.5 text-xs font-semibold {sevClass[row.severity]}">
          {rowValue(row)}
        </span>
      </div>
    {/each}
  </Card>

  <Card class="mb-2 p-3">
    <h2 class="mb-1 text-sm font-semibold text-text">{$_('monitoring.safety.info')}</h2>
    {#each data.infos as row}
      <div class="flex items-center justify-between py-2 text-sm">
        <span class="text-text-dim">{$_('monitoring.safety.' + row.key)}</span>
        <span class="rounded-full px-2.5 py-0.5 text-xs font-semibold {sevClass[row.severity]}">
          {row.count}
        </span>
      </div>
    {/each}
  </Card>

  {#if relay}
    <Card class="mb-2 p-3">
      <h2 class="mb-1 text-sm font-semibold text-text">{$_('monitoring.health.relay.title')}</h2>
      {#each relay as row}
        <div class="flex items-center justify-between py-2 text-sm">
          <span class="text-text-dim">{relayRowLabel(row)}</span>
          <span class="rounded-full px-2.5 py-0.5 text-xs font-semibold {sevClass[row.severity]}">
            {relayRowValue(row)}
          </span>
        </div>
      {/each}
    </Card>
  {/if}

  <Card class="mb-2 p-3">
    <h2 class="mb-1 text-sm font-semibold text-text">{$_('monitoring.health.maintenance.title')}</h2>
    <div class="flex flex-col gap-2 pt-2">
      <Button
        label={resetting
          ? $_('config.safety.resetting')
          : resetDone
            ? $_('config.safety.reset_done')
            : $_('config.safety.reset_faults')}
        variant="danger"
        disabled={resetting}
        onclick={() => (pendingReset = 'faults')}
      />
      {#if relay}
        <div>
          <Button
            label={resettingRelay
              ? $_('monitoring.health.relay.resetting')
              : resetRelayDone
                ? $_('monitoring.health.relay.reset_done')
                : $_('monitoring.health.relay.reset_button')}
            variant="danger"
            disabled={resettingRelay}
            onclick={() => (pendingReset = 'relay')}
          />
          <p class="mt-1 text-xs text-text-dim">{$_('monitoring.health.relay.reset_hint')}</p>
        </div>
      {/if}
    </div>
  </Card>
</div>

<ConfirmDialog
  visible={pendingReset === 'faults'}
  title={$_('config.safety.reset_faults_title')}
  body={$_('config.safety.reset_faults_body')}
  confirmLabel={$_('config.safety.reset_faults_confirm')}
  cancelLabel={$_('config.firmware.confirm_cancel')}
  onconfirm={resetFaultCounters}
  oncancel={() => (pendingReset = null)}
/>

<ConfirmDialog
  visible={pendingReset === 'relay'}
  title={$_('monitoring.health.relay.reset_title')}
  body={$_('monitoring.health.relay.reset_body')}
  confirmLabel={$_('monitoring.health.relay.reset_confirm')}
  cancelLabel={$_('config.firmware.confirm_cancel')}
  onconfirm={resetRelayHealth}
  oncancel={() => (pendingReset = null)}
/>
